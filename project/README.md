# Sinevia — Film ve Dizi Takip Uygulaması

Sinevia, film ve dizi koleksiyonunu takip etmek, puanlamak, yorumlamak ve sosyal olarak paylaşmak için geliştirilmiş bir web uygulamasıdır. PWA (Progressive Web App) olarak kurulabilir, çevrimdışı çalışabilir ve bulut senkronizasyonu ile birden fazla cihazda aynı veriyi kullanabilir.

**Sürüm:** 5.4

---

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Teknoloji Yığını](#teknoloji-yığını)
3. [Kurulum ve Çalıştırma](#kurulum-ve-çalıştırma)
4. [Uygulama Sekmeleri](#uygulama-sekmeleri)
5. [Film Yönetimi](#film-yönetimi)
6. [Dizi Yönetimi](#dizi-yönetimi)
7. [Puanlama Sistemi](#puanlama-sistemi)
8. [Yeniden İzleme (Rewatch) Sistemi](#yeniden-izleme-rewatch-sistemi)
9. [İzleme Geçmişi](#izleme-geçmişi)
10. [Koleksiyonlar ve Türler](#koleksiyonlar-ve-türler)
11. [Başarımlar](#başarımlar)
12. [XP ve Seviye Sistemi](#xp-ve-seviye-sistemi)
13. [SineCoin ve Pazar](#sinecoin-ve-pazar)
14. [Pazar Görevleri (Sözleşmeler)](#pazar-görevleri-sözleşmeler)
15. [Görevler (Quests)](#görevler-quests)
16. [Akademi ve Eğitim](#akademi-ve-eğitim)
17. [Kör Kalibrasyon (Düello)](#kör-kalibrasyon-düello)
18. [Sinematik Otopsi (DNF)](#sinematik-otopsi-dnf)
19. [Haftalık Plan](#haftalık-plan)
20. [İstatistikler](#istatistikler)
21. [Sinevia Ağı (Sosyal)](#sinevia-ağı-sosyal)
22. [Bulut Senkronizasyonu](#bulut-senkronizasyonu)
23. [Cihaz Yönetimi](#cihaz-yönetimi)
24. [Bildirimler](#bildirimler)
25. [Ayarlar](#ayarlar)
26. [Kısayollar](#kısayollar)
27. [PWA (Kurulabilir Uygulama)](#pwa-kurulabilir-uygulama)
28. [Yedekleme ve Geri Yükleme](#yedekleme-ve-geri-yükleme)
29. [Yapı ve Klasörler](#yapı-ve-klasörler)
30. [Testler](#testler)
31. [Lisans](#lisans)

---

## Genel Bakış

Sinevia, bir film ve dizi takip uygulamasıdır. Kullanıcılar filmlerini ve dizilerini ekleyebilir, puanlayabilir, not yazabilir, koleksiyonlar oluşturabilir, izleme geçmişini kaydedebilir. XP ve seviye sistemi, başarımlar, SineCoin ekonomisi, pazar ve görevler ile oyunlaştırılmış bir deneyim sunar. Bulut senkronizasyonu ile birden fazla cihazda aynı veri kullanılabilir.

Tekrar izleme (rewatch), kör kalibrasyon (düello), puan enflasyonu tespiti ve optimum retrieval ile zenginleştirilmiş detaylı istatistikler mevcuttur.

---

## Teknoloji Yığını

- **Frontend:** React 18 + TypeScript
- **Build:** Vite 5
- **Stil:** Tailwind CSS 3
- **Backend/Veritabanı:** Supabase (PostgreSQL + RPC + Storage)
- **Durum Yönetimi:** React Context (AppContext, QuestContext, TutorialContext, NetworkAuthContext)
- **Yerel Depolama:** IndexedDB (`sinevia-db`) + localStorage
- **PWA:** vite-plugin-pwa (service worker, manifest, offline cache)
- **Test:** Vitest (43 dosya / 619 test)
- **İkonlar:** lucide-react
- **Bildirimler:** Web Push (VAPID) + Service Worker
- **Ortam:** Node.js, npm

---

## Kurulum ve Çalıştırma

```bash
cd project
npm install
npm run dev          # Geliştirme sunucusu (http://localhost:5173)
npm run build        # Üretim derlemesi
npm run typecheck    # TypeScript kontrolü
npm run lint         # ESLint
npx vitest run       # Tüm testleri çalıştırır (43 dosya / 619 test)
npm run preview      # Üretim önizlemesi
```

Ortam değişkenleri (`.env`):
- `VITE_SUPABASE_URL` — Supabase proje URL'si
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_VAPID_PUBLIC_KEY` — Web Push VAPID public key (push:setup ile üretilir)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (yalnızca sunucu tarafı / teşhis)

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
| İstatistikler | Detaylı istatistikler (kalibrasyon, tekrar izlemeler, puan enflasyonu) |
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
- **Yeniden izleme:** Aynı film tekrar izlenince `rewatchCount` artar ve `rewatchStartedAt` güncellenir.
- **Yarım bırakma (DNF / Sinematik Otopsi):** Film yarım bırakılırsa autopsy kaydı.
- **Kör kalibrasyon:** Düello ile puan düzeltilir (`calibratedScore`, `duelCount`, `duelWins`, `duelLosses`).
- **Gerçek izleme süresi sayacı:** `startedAt`, `actualRuntime` ile izleme süresi takibi.
- **Hızlı izleme:** Orijinal süreden kısa sürede bitirme takibi.
- **Film arama/filtreleme:** Başlık, tür, koleksiyon, izlenmiş durumu.
- **Movie tipi opsiyonel alanları:** `calibratedScore?`, `duelCount?`, `duelWins?`, `duelLosses?`, `duelOpponents?`, `calibrationChanges?`, `rewatchStartedAt?`, `rewatchCount?` — hepsi opsiyonel, geriye uyumlu.

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
- **deletedEpisodes:** 30 günlük arşivleme; `DELETE_EPISODE` işleminde prune edilir.

---

## Puanlama Sistemi

- **10 üzerinden puanlama:** 0.5 artışlarla (0.5, 1, 1.5, ..., 10).
- **Yuvarlama:** `roundHalfRating(n)` = `clamp(Math.round(n*2)/2, 1, 10)`. Örnekler: 9.8→10, 9.1→9, 9.4→9.5, 5.56→5.5, 5.75→6.
- **Detaylı kriter puanlama:** Her film/dizi için birden fazla kriter (RatingCriterion) ile ağırlıklı puanlama. Kriterler kullanıcı tarafından oluşturulur (ad, ağırlık, uygulama alanı: film/dizi/ikisi, türler).
- **İnceleme notu:** Her yapım için metin notu.
- **İnceleme etiketleri (review tags):** Pozitif/negatif etiketler.
- **Puan düzenleme geçmişi:** `previousRating`, `ratingChangedAt`, `noteChangedAt`, `editedAt`.
- **Kör kalibrasyon düellosu:** İki filmi yan yana karşılaştırarak puan düzeltme.
- **Puan değiştirme eşiği:** `needsUpdate = |calibratedScore − rating| ≥ 0.5`. Fark 0.5'in altındaysa "Puanı Değiştir" butonu çıkmaz (yalnız görünürlük için listelenir).
- **Puan enflasyonu:** `suggestion = roundHalfRating(calibratedScore)`; gap = `suggestion − rating`; deviation = `calibratedScore − rating`.

---

## Yeniden İzleme (Rewatch) Sistemi

Bu bölüm README'nin önceki sürümlerinde yoktu; sürüm 5.0 ile eklendi.

- **Cooldown:** `REWATCH_COOLDOWN_MS = 30 gün`. `getRewatchCooldown(history, movieId, now)` sadece `isRewatch` olmayan (normal) izleme kayıtlarına bakar; en son normal izlemenin `watchedAt`'inden itibaren 30 gün bekleme zorunluluğu vardır.
- **Past watch istisnası:** Film yalnızca "past watch" olarak kaydedilmişse (normal izleme kaydı yoksa) beklemeden yeniden izlemeye başlanabilir.
- **Rewatch kaydı:** `WatchHistoryItem` alanları: `isRewatch: true`, `rewatchOfId` (ilk izleme kaydının ID'si), `watchNumber` (kaçıncı tekrar), `rewatchedFromPast` (past watch'tan mı gelindi).
- **Movie alanları:** `rewatchStartedAt?` (sayaç başlangıcı), `rewatchCount?` (kaç kez tekrar izlendi).
- **Sayaç (opsiyonel):** `startRewatchingMovie(id)` sayacı başlatır; `rewatchMovie()` timer olmadan da çalışabilir (`actualRuntime = maxMins`). Timer varsa geçen süre kullanılır.
- **Sayaç çakışma koruması:** Bir filmde zaten aktif normal timer (`startedAt`) veya rewatch timer (`rewatchStartedAt`) varsa başka bir sayaç başlatılamaz. `WATCH_MOVIE` reducer'ı her durumda `startedAt: null, rewatchStartedAt: null` yazar (eski sayaç temizliği).
- **UI:** MediaDetailModal'da rewatch modunda "Sayaç Başlat (Opsiyonel)" butonu, timer yokken de "Bitir & Puanla" aktif, "İlk izleme" şeridi (en eski kaydın tarihi, puanı, notu). HistoryPage'de "Tekrar İzle" butonu sadece modalı rewatch modunda açar (sayaç otomatik başlamaz).
- **Başarım:** `rewatch_master` (Tekrar İzleme Ustası), kademeler 1/3/5/10/25/50, XP 15/40/90/180/400/800, kategori "İzleme", icon `RotateCcw`.

---

## İzleme Geçmişi

- **Otomatik kayıt:** Film/dizi izlendiğinde `WatchHistoryItem` oluşturulur.
- **Geçmiş düzenleme:** Puan, not, etiket düzenlenebilir (`UPDATE_HISTORY_RATING`).
- **Geçmiş silme:** İzleme kaydı silinebilir.
- **Geçmiş filtreleme:** Tarih, tür, puan aralığı.
- **Yeniden izleme:** Aynı yapım tekrar izlenince yeni kayıt (`isRewatch: true`).
- **WatchHistoryItem alanları:** `id, itemId, seriesId, kind, type, title, rating, detailedRating, reviewTags, note, watchedAt, isPastWatch?, importedAt?, startedAt?, actualRuntime?, originalRuntime?, genres, year, season, episode, abandoned?, previousRating?, originalRating?, ratingChangedAt?, noteChangedAt?, editedAt?, ratingScope?, bulkRating?, bulkRuntimeMinutes?, isRewatch?, rewatchOfId?, watchNumber?, rewatchedFromPast?`.

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
- **Rewatch:** `rewatch_master` (Tekrar İzleme Ustası), kademeler 1/3/5/10/25/50.
- **Kalibrasyon:** `calibration_master` (Kalibrasyon Ustası), kademeler 1/3/5/10/25/50, XP 15/40/90/180/400/800, kategori "Puanlama", icon `Scale`. `calibration_master` `RATING_SCOPED_ACHIEVEMENTS` içinde **değil** → kalibrasyon panelinden puan değiştirilince bu başarım açılır, diğer puan-bağımlı başarımlar açılmaz.
- **Movie `calibrationChanges?`:** `APPLY_CALIBRATION_SUGGESTION` ile artırılır (sadece farklı puana geçildiğinde; aynı puan tekrarlanırsa artmaz).

Her başarımın birden fazla kademesi (bronze, silver, gold, platinum, emerald, diamond) ve XP ödülü vardır. Gizli başarımlar kullanıcıya gösterilmez (kilit ikonu ile).

---

## XP ve Seviye Sistemi

- **XP kazanma:** Film/dizi izleme, puanlama, not yazma, başarım açma, görev tamamlama, pazar görevleri.
- **Seviye:** XP toplamından hesaplanır (`levelFromXp`).
- **Seviye atlama kutlaması:** `LevelUpModal` ile.
- **XP defteri:** Tüm XP hareketleri kaydedilir (`xpEvents`, `xpLedger`).
- **XP kaynağı:** `source` ve `sourceId` ile izlenebilir (film, dizi, başarım, görev, pazar, vb.).
- **Coin dönüşümü:** XP → SineCoin dönüşümü (`xp_conversion`).
- **XP checkpoint:** 90 günden eski `xpEvents` tek `xp-checkpoint` kaydına katlanır (RAM/CPU tasarrufu).
- **Düello XP'si yok:** Düello sonucu XP vermez; ödül yalnızca "Terazi Ustası" başarımlarından gelir.

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
- **Puan değişimi ve görevler:** `APPLY_CALIBRATION_SUGGESTION` history kayıtına yazmıyor → puan-bağımlı görevler ve pazar görevleri tetiklenmez (bypass ile garanti altına alınmıştır).

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
- **Düello istatistikleri:** `duelCount`, `duelWins`, `duelLosses`, `duelOpponents`, `calibratedScore`.
- **Eşleşme kuralı:** İki film sadece aynı puanlı veya ±0.5 farkta düelloya girer (`pickDuelPair`).
- **Tekrar eşleşme engeli:** `haveDueled(a, b)` — `duelOpponents` dizisinde rakip varsa çift bir daha eşleşmez (200 rakip sınırı, `slice(-200)`).
- **Elo:** `calculateEloDelta` — kazanana +0.1, kaybedene −0.1 (clamp [1,10]); `calculateEloTie` — puan >5 ise +0.1, <5 ise −0.1, =5 ise 0.
- **Başarımlar:** Terazi ustası (`scale_master`), taht deviren (gizli, `secret_giant_slayer`).

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
- **Başyapıt Bandı:** Yalnız tam 10 puan (`num ≥ 10`, aralık `'10'`); Güçlü Yapımlar `7.0 – 9.9`.
- **Puan Enflasyonu Analizi:** `inflated` (puan kalibreden yüksek → düşürülecekler), `deflated` (puan kalibreden düşük → yükselilecekler), `pendingCount` (fark ≥0.5 olanlar).
- **En Kötü 6 Film:** Şeref Kürsüsü'nin altına taşındı, afişli 6'lı grid, `duelLosses` sıralaması (rating asc, eşitse duelLosses desc).
- **Tekrar İzlemeler paneli:** Toplam tekrar, benzersiz film, toplam süre, puan değişen film sayısı, top-5 liste (sıra, küçük poster, başlık, `×{count}` rozeti), kaydırılabilir yatay liste.
- **Puan renkleri (`ratingBgClass`):** ≥10 mavi, ≥8 yeşil, ≥5.5 sarı, ≥3.5 turuncu, ≥1 kırmızı.

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

- **Otomatik senkron:** İçerik hash'i değiştiğinde 90 saniyelik debounce sonrası buluta kayıt. Açılışta 1 kez, manuel, giriş/hesap değişimi ve çakışma çözümünde tetiklenir. Periyodik timer yok.
- **Çakışma çözümü:** Otomatik birleştirme (modal yok). Gerçek veri farkı varsa birleştirilir.
- **Çakışma hash'i:** Yalnızca gerçek kullanıcı verisi (filmler, diziler, XP, görevler, envanter, vb.) karşılaştırılır. Saat, cihaz, tema, eğitim, market sayaçları çakışma nedeni değildir.
- **Meta-first sync:** `sync_get_meta` (küçük) → hash aynıysa tam yük indirilmez; farklıysa `sync_get_state`.
- **`sync_commit`:** 7 parametreli imza (`p_agent_id, p_base_revision, p_device_id, p_payload, p_payload_gz, p_save_hash, p_summary`); gzip base64 production'da devre dışı (`p_payload_gz` her zaman null). Legacy 5 parametreli çağrıya düşmeyi destekler.
- **Debounce:** İçerik değişimi 90 sn; yerel kayıt 600 ms; tam yedek 10 sn debounce; sekme gizlenince/kapanınca anında flush.
- **`notify_poll` RPC:** Tek çağrıda friendships + recommendations + unread_messages toplanır (3 sorgu yerine 1). NetworkPage 180 sn aralıkla yoklar.
- **Önbellek:** `READ_CACHE_TTL_MS = 60 sn`, maksimum 80 kayıt, eşzamanlı aynı sorgular tek isteğe düşer, her yazma önbelleği temizler.
- **Sürüm yönetimi:** Sunucu tarafı revizyon numarası ile atomik commit.
- **Kimlik kurtarma:** Ağ hesabına bağlanınca yerel kimlik otomatik kurtarılır.
- **Yedek arşivi:** Eski Storage arşivinden otomatik içe aktarma.
- **Retention:** network_logs 12 ay + agent başına son 1000; süresi geçmiş `network_sessions`; `login_attempts` 30 gün; `push_subscriptions` 90 gün; `deletedEpisodes` 30 gün; `app_saves.last_seen` en fazla saatte bir; `payload_gz` bytea kolonu `app_saves` tablosunda (şu an kullanılmıyor, gelecek sıkıştırma için ayrılmış).
- **SQL Dosyaları:** `supabase/fix_ag_hatasi.sql`, `supabase/sync_commit_fix.sql`, `supabase/sync_get_meta_fix.sql`, `supabase/notify_poll_fix.sql`, `supabase/sql/temizlik_teknik_kayit.sql`.

---

## Cihaz Yönetimi

- **Cihaz listesi:** Ayarlar → Hesap ve Cihaz Yönetimi → "Bu Hesabın Cihazları".
- **Her cihaz:** Etiket (tarayıcı + işletim sistemi), son görülme zamanı.
- **Bu cihaz işareti:** Mevcut cihaz "Bu cihaz" rozeti ile işaretlenir.
- **Cihazdan çıkış:** Herhangi bir cihazdan uzaktan çıkış yapılabilir.
- **Mevcut cihazdan çıkış:** Mevcut cihazdan çıkınca sayfa yenilenir.
- **Ağ kimlik doğrulama:** `x-agent-token` (`sec_...`) ve `x-network-session` header'ları; `current_agent_id()` 3 çözüm yolu — `x-network-session` → `network_sessions`, `x-agent-token` → `profiles.secret_token`, tek cihaz durumunda `network_devices.device_secret`.

---

## Bildirimler

- **Web Push:** Uygulama kapalıyken bildirim (VAPID).
- **Uygulama içi bildirimler:** Toast mesajları.
- **Başarım bildirimleri:** `AchievementToasts` ile.
- **Seviye atlama bildirimi:** `LevelUpModal`.
- **Sözleşme kutlaması:** `ContractCelebrationOverlay`.
- **Bildirim tercihleri:** Kullanıcı ayarlayabilir (sunucu kopyası ile).
- **Bildirim yoklaması:** `notificationsEnabled && agentId && Notification.permission==='granted'` iken görünür sekmede 120 sn'de bir 3 sorgu (messages/friendships/recommendations).

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
│   └── test/                # Test dosyaları (43 dosya, 619 test)
├── supabase/
│   ├── schema.sql           # Kanonik veritabanı şeması
│   ├── schema/              # Modüler şema dosyaları (01_core, 02_functions, 03_security)
│   ├── migrations/          # Migration dosyaları
│   ├── fix_ag_hatasi.sql    # Ağ hatası düzeltme SQL'i
│   ├── sync_commit_fix.sql  # sync_commit imza düzeltmesi
│   ├── sync_get_meta_fix.sql # sync_get_meta fonksiyon düzeltmesi
│   ├── notify_poll_fix.sql  # notify_poll fonksiyon düzeltmesi
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
| `calibrationEngine.ts` | Düello Elo hesaplama, eşleşme seçimi |
| `rating.ts` | `roundHalfRating` puan yuvarlama |
| `rewatch.ts` | Rewatch cooldown hesaplama |

---

## Testler

```bash
npx vitest run                    # Tüm testleri çalıştırır (43 dosya / 619 test)
npx vitest run src/test/syncEngine.test.ts  # Belirli test
```

**Test dosyaları (43 dosya / 619 test):**

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
| `rewatch.test.ts` | Tekrar izleme (16 test) |
| `achievements.test.ts` | Başarım mantığı (rewatch_master, calibration_master) |
| `rating yuvarlama testi` | roundHalfRating (9.8→10, 9.1→9, 9.4→9.5, 5.56→5.5) |

---

## Lisans

Özel proje. Tüm hakları saklıdır.
