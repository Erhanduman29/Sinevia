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
6. `migrations/004_network_auth.sql` (ağ hesabı: kullanıcı adı + şifre)
7. `migrations/005_coklu_cihaz.sql` (aynı hesap, sınırsız cihaz + senkron)
8. Tekrar `verify.sql` → satır sayıları aynı mı, RLS `true` mu, policy'ler yerinde mi?

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

## 004'den sonra ne değişir?

- `network_accounts` tablosu: kullanıcı adı + kilitli şifre + kurtarma kodu + bağlı profil.
- `network_sessions` tablosu: aktif ağ giriş oturumları (30 gün geçerli).
- `login_attempts` tablosu: giriş deneme kaydı.
- RPC'ler: `network_register`, `network_login`, `network_logout`, `network_get_me`, `network_change_password`, `network_delete_account`.
- Kullanıcı adı büyük/küçük harf duyarsız olarak benzersizdir (`erhan` = `ERHAN`).
- **Mevcut hesaplar korunur:** `network_register` yeni boş profil açmaz; cihazdaki
  mevcut `agent_id` + gizli anahtarı doğrulayıp o profili ağa bağlar. Böylece
  kütüphane, geçmiş, XP ve sosyal veriler yerinde kalır. Aynı profile ikinci bir
  ağ hesabı bağlanamaz (unique index).
- Başka bir cihazdan giriş yapılırsa ağ hesabının bulut yedeği çekilir; yedek
  yoksa giriş geri alınır ve cihazdaki kütüphaneye dokunulmaz.
- Ağdan çıkış sadece oturumu sonlandırır; profil ve kütüphane kalır.
- "Hesabımı Sil" ağ hesabını, profili ve tüm ilişkili verileri siler.

## 005'ten sonra ne değişir? (çoklu cihaz)

- Aynı hesap **telefon, tablet, bilgisayar, farklı tarayıcılar** dahil
  sınırsız cihazda aynı anda açık kalabilir.
- `network_devices` tablosu: her cihazın kendi gizli anahtarı. Profilin tek
  anahtarı artık cihazları kilitlemiyor.
- `can_write_profile` ve `protect_profile_trigger` artık **hesaba kayıtlı
  cihaz anahtarını da** kabul eder. Böylece ikinci cihaz da bulut eşitlemesi
  yapabilir ("Bulut Ağı: Bağlantı Yok" sorunu biter).
- `network_login` diğer cihazların oturumlarını **silmez** (eski sürüm
  siliyordu; bu yüzden aynı anda iki cihaz açık kalamıyordu).
- `network_claim_device` profilin anahtarını **ezmez**; yalnızca cihazı
  hesaba kaydeder. Giriş yapan her yeni cihaz otomatik kaydedilir.
- Eşitleme mevcut düzende çalışır: yerel değişiklik ~3,5 sn sonra buluta
  yazılır, diğer cihazlar 60 sn'de bir (ve sekme görünür olunca) çeker.
- `network_devices` satırları hesap silinince otomatik silinir
  (`on delete cascade`).

### Eski anahtarı olmayan hesaplar (manuel bağlama)
Uygulama "Bu cihazdaki hesap doğrulanamadı. Manuel destek gerekir." derse,
tarayıcıdaki `sinevia_secret_token` ile `profiles.secret_token` eşleşmiyor
demektir. Tipik sebepler:

- hesap başka bir tarayıcıda/cihazda oluşturulmuş,
- hesap **taşıma kodu** ile bu cihaza getirilmiş (agent_id kopyalanır, gizli
  anahtar kopyalanmaz),
- tarayıcı verilerinin bir kısmı silinmiş,
- gizli mod (incognito) kullanılmış.

Bu durumda `manuel_baglama.sql` dosyasını çalıştırın. Dosya bir
`network_admin_link(agent_id, kullanıcı adı, şifre)` fonksiyonu tanımlar:

- yalnızca SQL Editor (service_role / postgres) çağırabilir; uygulamadan
  erişilemez (`revoke` edildi),
- kütüphaneye/geçmişe/XP'ye dokunmaz,
- zaten bağlı bir hesabı yeniden bağlamaz (hata verir),
- kullanıcı adı başkası tarafından alınmışsa reddeder,
- başarıda **kurtarma kodunu** döndürür (bir yere yazılmalı).

Bağladıktan sonra uygulamada "Hesabını Bağla → Giriş yap" ile girilir.

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

## Web Push (006_web_push.sql)

Uygulama kapalıyken bildirim için gerçek Web Push kullanılır.

- `push_subscriptions`: her cihazın push aboneliği (endpoint benzersiz).
- `network_notification_prefs`: bildirim tercihlerinin sunucu kopyası;
  Edge Function push göndermeden önce buraya bakar.
- `push_webhook_config`: tek satırlık, istemciye kapalı ayar tablosu
  (webhook secret + fonksiyon adresi). Proje taşınırsa yalnızca
  `endpoint` güncellenir.
- `push_dispatch_webhook`: `messages`, `friendships`, `recommendations`
  INSERT olaylarını `pg_net` ile Edge Function'a iletir. Hata olsa bile
  asıl INSERT'i bozmaz.

Kurulum (tek komut):

```powershell
npm run push:setup
```

Komut VAPID anahtarlarını üretir, `db push` ile bu migration'ı uygular,
Edge Function secret'larını yükler ve `send-push` fonksiyonunu
`--no-verify-jwt` ile yayınlar. Ardından `VITE_VAPID_PUBLIC_KEY`
değerini Vercel/Netlify ortam değişkenlerine ekleyip yeniden deploy edin.

Notlar:
- `npm run dev` service worker'ı kapattığı için push yalnızca
  `npm run build && npm run preview` veya yayındaki sitede test edilir.
- iOS/iPadOS 16.4+ ve "Ana Ekrana Ekle" ile kurulmuş PWA şarttır.
- Uygulama açıkken bildirimler ayrıca 45 saniyelik REST yoklamasıyla
  gösterilir; realtime bu projede `x-agent-token` başlığını websocket
  üzerinden taşımadığı için kullanılmaz.
