# Sinevia v5.1 — Mimari Refactoring, Senkronizasyon ve Performans Raporu

Bu doküman, v5.0 sonrasında tespit edilen performans darboğazları, senkronizasyon davranışları ve Supabase free-plan kota kullanımını ele alır.

Doküman iki bölümden oluşur:

- **Bölüm A — Mevcut Gerçek Durum:** kodda doğrulanmış davranışlar.
- **Bölüm B — v5.1'de Uygulananlar:** hayata geçirilen değişiklikler.
- **Bölüm C — Değerlendirilip Uygulanmayanlar:** neden yapılmadığı kanıtlarıyla.

> Düzeltme notu: v5.1 taslağındaki bazı iddialar (ör. "senkron sessiz son-yazan-kazanır", "sayaç aktif döngüye bağlı", "context tek dev nesne") kodla uyuşmuyordu. Bu sürümde her iddia dosya/satır referansıyla düzeltilmiştir.

---

## Bölüm A — Mevcut Gerçek Durum (v5.0 sonrası, doğrulanmış)

### A.1 Senkronizasyon "son yazan kazanır" DEĞİL
`src/lib/syncEngine.ts` içindeki `decideSyncAction` 8 adımlı bir karar matrisi uygular:

| Durum | Davranış |
|---|---|
| Bulut boş | Yükle |
| Hash'ler aynı | Hiçbir şey yapma |
| Sahip farklı | `owner-mismatch` çakışması (yazmaz) |
| Yalnız yerel değişmiş | Yükle |
| Yalnız bulut değişmiş | İndir |
| İki taraf da değişmiş | **Otomatik birleştirme** (`autoMergeAndCommit`) |
| Birleştirme yarışı | 3 denemeye kadar taze bulutla yeniden dene |
| Denemeler tükenirse | `status: 'error'` (yeniden denenebilir) |

Yani sessiz veri ezme yoktur. Gerçek eksik, birleştirme *kuralının* zaman damgası yerine "kayıt zenginliği" (dolu alan sayısı) kullanması ve silinen kayıtların geri gelebilmesiydi. Bölüm B.2 bunu çözer.

### A.2 Sayaç verisi zaten pasif
`src/context/AppContext.tsx` → `getMovieTimerInfo(movie, nowMs)`:

```
startMs   = new Date(movie.startedAt).getTime()
elapsedSec = clamp(floor((nowMs - startMs) / 1000), 0, totalSec)
```

Süre `startedAt` zaman damgasından türetilir; `setInterval` sayacın **verisini** değil yalnızca ekrandaki saniye yazısını besler. `PAUSED:<sn>` biçimi duraklatmayı temsil eder. Minimum puanlama süresi `max(5, ceil(runtime * 0.15))` dakikadır.

Eksik olan tek şey görsel tik'in koşulsuz çalışmasıydı — Bölüm B.3'te düzeltildi.

### A.3 Context zaten dilimlenmiş
`AppContext.tsx` içinde 5 ayrı React Context sağlayıcısı vardır (`Library`, `Gamification`, `Settings`, `Market`, `Timer`) ve `src/context/slices.ts` bunlar için hook'lar sunar. Dolayısıyla "monolitik context her değişimde tüm uygulamayı render ediyor" ifadesi eksikti; tek gerçek sorun `value` nesnesinin her render'da yeniden oluşturulması ve sayfaların `useApp()` ile tüm dilimlere abone olmasıydı. Bölüm B.4 bunu çözer.

### A.4 Supabase kullanımı (optimizasyon öncesi sorunlar)
- Her senkron turunda tam payload indiriliyordu (değişiklik olmasa bile).
- Bildirimler için her turda 3 ayrı tablo sorgulanıyordu.
- `app_saves.payload_gz` kolonu yazılıyor ama hiç okunmuyordu (diskte ikinci kopya).
- Teknik kayıtlar (oturumlar, giriş denemeleri, ağ logları, push abonelikleri) süresiz birikiyordu.

---

## Bölüm B — v5.1'de Uygulananlar

### B.1 Meta-first senkronizasyon + tek RPC bildirim
- `sync_get_meta(p_agent_id)` yalnızca `{ revision, save_hash, updated_at, device_id }` döner. Hash aynıysa tam payload **hiç indirilmez**.
- RPC başarısız olursa `sync_get_state`'e düşer ve 1 saat boyunca meta'yı tekrar denemez.
- `notify_poll(p_agent_id)` üç bildirim sorgusunu tek `jsonb` yanıtında toplar.
- `sync_commit` **7 parametreli** imzaya geçti (`p_payload_gz`, `p_summary` eklendi). `p_payload_gz` her zaman `null` gönderilir; gzip CPU maliyeti kaldırıldı. Eski 5'li imza drop edilir (PGRST203 belirsizliğini önlemek için).
- Bulut senkron debounce 30 sn → **90 sn**; ağ sayfası yoklaması 180 sn; okuma önbelleği 60 sn / 80 kayıt.

### B.2 Merge V2 — "daha yeni kazanır" + silme taşları (`syncMergeV2` bayrağı)
Yeni `src/lib/syncMerge.ts`:

- `itemTimestamp(item)`: `updatedAt → editedAt → ratingChangedAt → noteChangedAt → watchedAt → createdAt → importedAt` sırasıyla ilk geçerli zaman.
- `mergeTombstones`: `${type}:${id}` anahtarında en yeni `deletedAt` kazanır.
- `isTombstoned`: silme zamanı kaydın zaman damgasından yeni/eşitse kayıt gizlenir; **silme sonrası yeniden oluşturulan kayıt yaşar**.
- `MAX_TOMBSTONES = 500` (disk koruması).

Davranış:

| Bayrak | Aynı id'de kazanan | Silinen kayıt |
|---|---|---|
| Kapalı (varsayılan) | Zenginlik skoru (eski davranış) | Geri gelebilir |
| Açık | Daha yeni zaman damgası | Taş varsa geri gelmez |

Silme taşları `DELETE_MOVIE`, `UNWATCH_MOVIE` (history), `DELETE_SERIES`, `DELETE_COLLECTION` reducer'larında yazılır. Bayrak `localStorage` üzerinden açılabilir: `{"syncMergeV2": true}` (`sinevia_flag_overrides`).

### B.3 Görünürlük duyarlı sayaç — `useVisibleNow`
Yeni `src/hooks/useVisibleNow.ts`:

- Sekme görünürken saniyede bir tik.
- Sekme gizliyken **hiç interval çalışmaz**.
- Sekmeye dönüldüğünde anında `Date.now()` ile tazeler.
- Test enjeksiyonu için `source`, `setIntervalFn`, `clearIntervalFn` parametreleri.

Entegre edildi: `HomePage`, `MoviesPage`, `AgentProfileModal`, `MediaDetailModal`, `WeeklyPlanPage`, `QuestBoard`.

### B.4 Render optimizasyonu
- Provider `value` nesnesi `useMemo` ile memoize edildi (`actionDeps` + transient alanlar bağımlılık listesinde).
- Sayfalar dilim hook'larına taşındı: `AchievementsPage`, `HistoryPage`, `SeriesPage`, `MarketPage`, `NetworkPage`, `WeeklyPlanPage`, `HomePage`, `SettingsPage`, `MoviesPage`.
- `MarketSlice` eklendi (coins, inventory, equipped, activeEffects, coinLedger, perks, paktlar, market nonce'ları).
- `GamificationSlice`'e `xpEvents`, `SettingsSlice`'e `nickname`, `tagSentiments`, `notifyFriendRequests`, `notifyLists`, `notifyMessages` eklendi.
- Yalnızca geçici alanları (`syncStatus`, `toasts`) kullanan `Layout` hâlâ `useApp()` kullanır.

### B.5 Teknik kayıt temizliği (retention)
`sql/temizlik_teknik_kayit.sql`:

| Tablo | Kural |
|---|---|
| `network_logs` | 12 aydan eski + ajan başına son 1000 |
| `network_sessions` | `expires_at < now()` |
| `login_attempts` | 30 gün |
| `push_subscriptions` | 90 gün |
| `app_saves.payload_gz` | `null`'a çekilir |

Uygulama tarafı: XP defteri 90 günden eski kayıtları tek checkpoint'e katlar (toplam XP değişmez), `deletedEpisodes` 30 gün, `duelOpponents` son 200 rakip, `profiles.last_seen` saatte bir.

### B.6 Değişmez veri kuralları
- İzleme geçmişi (history) **asla silinmez**.
- Film/dizi detay bilgisi (özet, kadro, anahtar kelimeler) **asla silinmez**.
- Temizlik yalnızca teknik kayıtlarda yapılır.
- Yeni alanlar opsiyoneldir; eski istemciler çalışmaya devam eder.

---

## Bölüm C — Değerlendirilip Uygulanmayanlar

### C.1 Event sourcing tabanlı senkronizasyon
Öneri: her kullanıcı eylemini (`RATE_MOVIE`, `ADD_HISTORY`) kuyruğa yazıp sunucuda kronolojik işlemek.

**Neden uygulanmadı:**
1. Reducer'lar saf değil: `Date.now()`, yerel saat dilimi (`todayStr()`), `uid()` kullanılıyor → olayların yeniden oynatılması deterministik değil.
2. Başarımlar, XP defteri, görevler ve pazar ekonomisi olay olarak modellenmeden geçiş veri kaybı riski taşır.
3. Sunucuda idempotent `process_sync_events` RPC'si ve şema değişikliği gerekir.
4. Mevcut çakışma çözümü zaten otomatik birleştirme yapıyor; "son yazan kazanır" sorunu yoktu.
5. 650 testlik doğrulanmış veri katmanını riske atmak kazanç/risk oranı açısından doğru değildi.

Bunun yerine hedeflenen fayda B.2 (daha yeni kazanır + tombstone) ve B.1 (meta-first) ile daha düşük riskle sağlandı.

### C.2 Zustand'a geçiş
Öneri: `create + persist` ile atomik state.

**Neden uygulanmadı:**
1. `persist` varsayılan olarak `localStorage` kullanır (≈5 MB sınırı). Proje IndexedDB (`sinevia-db`) + `storageService.ts` + `localStateV3.ts` migrasyonu kullanıyor.
2. Taslaktaki `partialize` yalnızca `movies` ve `history` yazıyordu → başarımlar, XP defteri, görevler, pazar envanteri kaybolurdu.
3. Mevcut dilimli context + `useMemo` aynı render izolasyonunu sağlıyor.

Sonuç: kalıcı veri asla Zustand persist'e taşınmayacak. Yalnızca gelecekte geçici UI durumu için değerlendirilebilir.

---

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| `npm run typecheck` | Temiz |
| `npx vitest run` | **46 dosya / 650 test** geçti |
| `npm run build` | Başarılı |
| Yeni testler | `useVisibleNow.test.ts` (5), `featureFlags.test.ts` (6), `syncMerge.test.ts` (20) |

---

## İlgili Dosyalar

| Dosya | Amaç |
|---|---|
| `src/lib/syncEngine.ts` | Karar matrisi, meta-first senkron, otomatik birleştirme |
| `src/lib/syncMerge.ts` | Tombstone + "daha yeni kazanır" birleştirme |
| `src/lib/featureFlags.ts` | `syncMergeV2` bayrağı (varsayılan kapalı) |
| `src/hooks/useVisibleNow.ts` | Görünürlük duyarlı saniye tik'i |
| `src/lib/renderProbe.ts` | Dev-only render sayacı |
| `src/lib/supabase.ts` | İstemci, başlıklar, 60 sn okuma önbelleği |
| `src/context/AppContext.tsx` | Reducer, aksiyonlar, dilim provider'ları |
| `src/context/slices.ts` | Dilim hook'ları |
| `supabase/sync_get_meta_fix.sql` | Meta RPC |
| `supabase/sync_commit_fix.sql` | 7 parametreli commit + `payload_gz` |
| `supabase/notify_poll_fix.sql` | Bildirim RPC'si |
| `supabase/fix_ag_hatasi.sql` | Birleşik ağ hatası düzeltmesi |
| `sql/temizlik_teknik_kayit.sql` | Retention |
| `scripts/delete-legacy-archives.js` | Storage yetim dosya taraması |
