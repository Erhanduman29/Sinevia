# Sinevia Supabase — Güvenli Geçiş Rehberi

Bu klasör, Supabase SQL Editor'de dağınık duran 8 eski query'nin yerine
geçen **tek sıralı, tekrar çalıştırılabilir** dosyaları içerir.

## Altın kural

**Eski 8 query bir daha çalıştırılmayacak.** Özellikle içinde
`DROP TABLE ... CASCADE` olan dosya, `profiles` dahil tüm kullanıcı
verilerini siler.

Buradaki dosyaların hiçbirinde `DROP TABLE`, `TRUNCATE` veya
`DELETE FROM profiles` yoktur. Sadece:

- eksik tablo/kolon **ekler**,
- index **ekler**,
- kilit (RLS) **takars**,
- fonksiyon **tanımlar**.

## Sıra

1. **Yedek al.**
   - Supabase Dashboard → Database → Backups (varsa indir).
   - `verify.sql` çalıştır, çıktıyı kaydet (satır sayıları).
   - Storage → `sinevia_saves` içindeki dosyaları indir/kopyala.
2. `verify.sql` (salt okunur) → sonucu sakla.
3. `migrations/001_schema.sql`
4. `migrations/002_security.sql`
5. `migrations/003_functions.sql`
6. Tekrar `verify.sql` → satır sayıları aynı mı, RLS `true` mu, policy'ler yerinde mi?

Her dosya kendi `begin ... commit` bloğunu içerir. Bir hata olursa
o dosyanın tamamı geri alınır; yarım kalmaz.

> **Önemli sıra notu:** `002_security.sql`, `profiles.secret_token` kolonunu
> okunamaz yapar. Eski istemci hâlâ `select('*')` kullanıyorsa profil
> sorguları hata verir. Bu yüzden **önce yeni istemciyi yayına alın**, sonra
> 002'yi uygulayın. Kullanıcıların eski PWA önbelleği varsa bir kez sert
> yenileme (Ctrl+F5) yapmaları gerekebilir.

## 002'den sonra ne değişir?

- `profiles.secret_token` **okunamaz** (kolon yetkisi kaldırılır).
  İstemci artık profilleri `select('*')` ile çekmiyor.
- Profil yazma/güncelleme/silme yalnızca **kendi ajan anahtarınla** yapılır.
- `x-agent-token` başlığı yoksa yazma reddedilir (eski bypass kapanır).
- Mesaj, arkadaşlık, öneri, grup ve akış yazmaları sahiplik kontrolünden geçer.
- Akış (`network_logs`) ve profiller herkese **okunur** kalır; yazma kilitlidir.

## Bilinçli olarak yapılmayanlar

- **Storage private yapılmadı.** Mevcut istemci `getPublicUrl` kullanıyor;
  private'a geçmek tüm bulut yedeklerini anında bozar. Önce istemcide
  imzalı URL / Edge Function desteği gerekir. Bu, Faz 2 işi.
- **Realtime tamamen kapatılmadı.** Ağ sayfasındaki filtresiz abonelik
  istemciden kaldırıldı; mesajlar artık kısa aralıklarla kontrol ediliyor.
  Ayrıca `profiles` tablosu `supabase_realtime` yayınından **çıkarıldı**:
  aksi halde realtime satırı `secret_token` ile birlikte istemcilere
  gidebiliyordu. Bulut durumu artık 60 saniyede bir yoklanıyor.
- **Eski satırlar silinmedi.** `NOT VALID` kısıtlar sayesinde eski aykırı
  kayıtlar migration'ı durdurmaz. `verify.sql` kaç aykırı kayıt olduğunu
  gösterir; temizlik gerekiyorsa ayrı ve onaylı bir adımda yapılır.
- **Legacy profiller:** `secret_token` boş olan eski profiller, ilk
  güncellemede o cihazın anahtarıyla mühürlenir. Bu geçiş davranışıdır.

## Geri dönüş

Veri silinmez. Gerekirse:

```sql
-- Sadece politikayı kaldırır, veriye dokunmaz:
drop policy if exists profiles_update_self on public.profiles;
```

RLS'i tamamen kapatmak son çare olmalı; eski `GRANT ALL` durumuna dönmek
güvenlik açığını geri getirir.

## İstemci tarafı (bu repoda yapılanlar)

- `NetworkPage` içindeki filtresiz realtime aboneliği kaldırıldı.
- Ağ verisi 45 saniyede bir, sekme görünür olduğunda yenileniyor.
- Açık sohbet 20 saniyede bir yenileniyor.
- Sorgular paralelleştirildi; liderlik 50, akış 100 kayıtla sınırlandı.
- Profil sorguları `select('*')` yerine izinli kolonları çekiyor.
- Bulut yedeği upsert'inden `secret_token` çıkarıldı (trigger zaten mühürlüyor).
- Bulut arşivi realtime yerine 60 saniyede bir ve sekme görünürken yoklanıyor.

## Test (iki hesap)

1. A hesabıyla giriş yap; profilini güncelle → başarılı olmalı.
2. B hesabının `agent_id`'si ile A'nın token'ını kullanarak profil güncellemeyi dene → reddedilmeli.
3. Token başlığını tamamen kaldırıp yazmayı dene → reddedilmeli.
4. A, B'nin mesajlarını okuyamamalı; ortak gruptaki mesajları okuyabilmeli.
5. Arkadaşlık isteği gönder/kabul et; akış ve liderlik tablosu dolmalı.
6. Bulut yedeği yüklenmeli; sayfa yenilenince geri gelmeli.
7. Hesap silme yalnızca "hesabımı sil" akışında çalışmalı.
