Rol: Kıdemli Frontend (React/TypeScript) ve Supabase Geliştiricisisin.
Proje: Sinevia — Oyunlaştırılmış Film ve Dizi Takip Uygulaması (PWA, IndexedDB + Supabase).
Görev: Kullanıcıların Letterboxd, Trakt ve IMDb platformlarından aldıkları CSV veri çıktılarını Sinevia sistemine sorunsuz bir şekilde aktarmalarını sağlayacak bir "İçe Aktarım Motoru (Migration Engine)" yazmanı istiyorum.

Aşağıdaki mimari kurallara, veri haritalama standartlarına ve UI akışlarına harfiyen uymalısın.

1. Mimari ve Akış Kuralları

İstemci Tarafı İşleme: Yüklenen .csv dosyaları sunucuya gönderilmeden önce tarayıcıda (PapaParse vb. ile) okunmalı ve parse edilmelidir.

TMDB Zenginleştirmesi: Sadece adı veya IMDb ID'si olan eksik veriler için TMDB API kullanılarak (Promise.allSettled ile batch halinde) afiş, süre ve tür bilgileri çekilmelidir (Rate-limit koruması eklenmelidir).

Önizleme: Kullanıcıya eşleşen, manuel kontrol gerektiren (isim benzerliği) ve hata veren kayıtların listelendiği bir "Önizleme Tablosu" sunulmalıdır.

Kayıt: Veriler tek seferde localStateV3 store'una aktarılmalı (IMPORT_LEGACY_DATA reducer action'ı ile) ve ardından Supabase syncEngine tetiklenmelidir.

2. Veri Haritalama Standartları (Data Mapping)

Gelen verileri aşağıdaki haritalama kurallarına göre standart Sinevia (Draft Object) modeline dönüştür.

A. Letterboxd (diary.csv / ratings.csv)

Name -> title

Year -> year (Number)

Letterboxd URI -> TMDB/IMDb ID çözümlemesi için kullanılacak.

Rating -> rating (Letterboxd 5 yıldız sistemi kullanır. Gelen değeri 2 ile çarp örn: 3.5 yıldız -> 7.0 puan)

Watched Date -> watchedAt (ISO Date)

Review -> note

Tags -> reviewTags (Array)

B. Trakt (history.csv / ratings.csv)

Title -> title

Type -> type (movie veya series olarak yönlendir)

tmdb_id -> tmdbId (Doğrudan eşleşme, birincil anahtar)

Rating -> rating (Değişiklik yapma, zaten 1-10 arası)

Watched_At -> watchedAt (ISO Date)

C. IMDb (ratings.csv)

Const -> imdbId (Örn: tt0111161 - Doğrudan IMDb ID. TMDB'de find endpointi ile tmdbId'ye dönüştürülebilir)

Title -> title

Title Type -> type (movie -> Film, tvSeries / tvMiniSeries -> Dizi)

Your Rating -> rating (Değişiklik yapma, 1-10 arası tam sayı)

Year -> year (Number)

Date Rated -> watchedAt (Tarih formatını ISO'ya çevir)

3. Oyunlaştırma ve Ekonomi Kuralları (KRİTİK)

İçe aktarılan binlerce kayıt, uygulamanın ekonomisini çökertmemelidir. Bu nedenle oluşturulacak objelere şu kurallar uygulanmalıdır:

isPastWatch: true Flag'i: İçe aktarılan tüm yapımlara bu bayrak eklenmeli. Gerçek izleme süresi (zamanlayıcı) sayaçlarını tetiklememeli.

XP Kısıtlaması: aktarım yapılan film ve diziler mevcut başarımları tetiklemeyecek. xp kazanılmayacak. veri aktarımına özel başarımlar eklenip bu başarımlardan xpler kazanılabilecek.

Pazar Görevleri: Aktarılan veriler aktif "Günlük/Haftalık Görevleri" (Sözleşmeleri) TAMAMLAMAMALIDIR. (Görev doğrulama mantığında isPastWatch veya importedAt alanı kontrol edilmelidir).

Özel Başarım: "Büyük Göç" (Harici bir kaynaktan koleksiyon aktardın) adlı yeni bir başarım tetiklenmelidir.

4. İstediğim Çıktılar

Lütfen bu kurallara göre aşağıdaki dosyaları ve kodları oluştur:

parsers.ts (Letterboxd, Trakt ve IMDb CSV'lerini okuyup standart Sinevia objesine çeviren fonksiyonlar).

MigrationWizardModal.tsx (Kullanıcının dosya yükleyip önizleme yapacağı UI bileşeni).

reducerActions.ts içerisine eklenecek toplu ekleme state mantığı.