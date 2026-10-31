# Sinevia V3 — App State & Sync Contract

Durum: **sözleşme (types only)**. Bu doküman davranışı tarif eder; uygulama
AppContext / storageService / SQL tarafında ayrı adımlarda yapılır.

Kaynak dosyalar:

| Dosya | İçerik |
| --- | --- |
| `src/types/appState.ts` | `AppStateV3`, `XpEvent`, `XpEventSource`, `XpLedgerSummary`, alt bloklar |
| `src/types/sync.ts` | `SAVE_SCHEMA_VERSION`, `SaveEnvelope`, `SyncConflict`, `SyncResult`, `ConflictChoice` |
| `src/lib/syncContract.ts` | `makeSaveHash`, `buildSaveEnvelope`, `buildSyncSummary`, `nextRevision`, `canFastForward`, defter yardımcıları |
| `src/test/appStateContract.test.ts` | Sözleşme testleri (22) |

---

## 1. Yerel kayıt (canonical local record)

Tek kanonik yerel kayıt `AppStateV3`'tür. Zarf alanları:

| Alan | Tip | Kural |
| --- | --- | --- |
| `schemaVersion` | `3` | Sabit. Farklıysa kayıt reddedilir/göç ettirilir. |
| `ownerAgentId` | `string \| null` | `SNV-xxxx-xxxx`. Sahipsiz yerel kayıt `null`. |
| `revision` | `number` | En son **sunucudan** bilinen revizyon. İstemci kendi kendine artırmaz. |
| `updatedAt` | ISO 8601 | Her içerik değişiminde yenilenir. |
| `deviceId` | `string` | Cihaz kimliği (göç/telemetri). |
| `xpEvents` | `XpEvent[]` | XP'nin tek kaynağı (append-only). |

Site verisi düz alanlar halinde taşınır (V2 → V3 göçü neredeyse kopyalama):

- **Kütüphane:** `movies`, `series`, `collections`, `history`, `genres`,
  `removedSeriesTitles`, `criteria`, `showcase`
- **Oyunlaştırma:** `achievements`, `quests` (`completedQuests` dahil, artık
  **XP kaynağı değil**), `coins`, `coinLedger`, `inventory`, `equipped`,
  `activeEffects`, `perks`, `marketStats`, `pinnedContract`, pazar nonce'ları,
  streak alanları, düello sayaçları
- **Planlama:** `weeklyPlan`, `externalActions`
- **Eğitim:** `tutorial` (V2 `sinevia-tutorial-v1`), `academy` (V2
  `sinevia-academy-ui-v1`)
- **Ayarlar:** `settings` (tema, bildirim/eşleşme bayrakları, görünüm
  tercihleri, `altWatchTemplate`)
- **Yerel-only:** `lastCloudSync`, `aiChatHistory` — hash'e girmez, buluta
  yazılmaz.
- **Escape hatch:** `legacy` — eşlenemeyen eski alanlar burada korunur.

**Kaldırılan türetilmiş XP alanları:** `totalXp`, `xp`, `xpBaseline`,
`bonusXp`, `level` V3 kaydında **yoktur**. Göç, bunları tek seferlik
`xpEvents` kayıtlarına çevirir (`legacy`, `legacy-cloud`, `adjustment`).
`level` her zaman `levelFromXp(totalXp)` ile türetilir.

> `lastSyncedHash` (cihazın en son başarıyla eşitlediği gövde hash'i) gövdeye
> **girmez**; cihaz başına sync meta'da tutulur (hash'i kendini kirletmesin).

---

## 2. XP defteri kuralları

```
totalXp = Σ xpEvents[i].amount
```

1. **Append-only.** Kayıt silinmez/düzenlenmez; düzeltme negatif `adjustment`
   kaydıdır. Defter boşsa `totalXp = 0`.
2. **Tek doğru.** Hiçbir alan (`achievements`, `quests`, `bonusXp`, bulut
   `total_xp`) XP'yi tekrar beslemez. `sum` dışında XP hesaplanmaz.
3. **İdempotency `(source, sourceId)`.** Aynı çiftten ikinci kayıt yazılmaz
   (`hasXpEvent` / `xpEventKey`). `id` tekildir ama idempotency anahtarı
   değildir.
4. **`amount = Math.round(base * multiplier)`.** `base` negatif olabilir.
   `multiplier` varsayılan `1`.
5. Kaynak örnekleri: `achievement` → `sourceId = "<achievementId>:<tier>"`,
   `quest` → `questId`, `contract` → `instanceId`, `market` → `coinTx.refId`,
   `system` → sabit sistem anahtarı.
6. Göç kayıtları: V2 yerel `totalXp` → `legacy`, bulut `total_xp` → `legacy-cloud`,
   kalan sapma → `adjustment`. Aynı hesapta tek kez yazılır
   (`sourceId = "migration-v3"`).

---

## 3. Senkron karar matrisi

Girdiler:

- `localHash = makeSaveHash(local.payload)`
- `lastSyncedHash` — cihazın son başarılı eşitlemede gördüğü hash (sync meta)
- `cloud` = `sync_get_state(owner)` sonucu (revizyon + hash + payload)

| # | Koşul | Yapılan | `SyncResult` |
| --- | --- | --- | --- |
| 1 | Bulut kaydı yok | Commit `baseRevision = 0` | `local-uploaded` |
| 2 | `sameSaveHash(localHash, cloud.hash)` | Hiçbir şey (meta güncellenir) | `up-to-date` |
| 3 | `localHash === lastSyncedHash` (yerel temiz) ve `canFastForward(local.revision, cloud.revision)` | Bulutu uygula | `cloud-loaded` |
| 4 | `cloud.hash === lastSyncedHash` (bulut temiz) ve yerel kirli | Commit `baseRevision = cloud.revision` | `local-uploaded` |
| 5 | Yerel kirli ve `cloud.hash !== lastSyncedHash` | Yazma yok | `conflict` reason `both-changed` |
| 6 | `cloud.ownerAgentId !== local.ownerAgentId` | Yazma yok | `conflict` reason `owner-mismatch` |
| 7 | Commit `baseRevision !== server.revision` (sunucu reddetti) | Yazma yok | `conflict` reason `revision-mismatch` |
| 8 | Ağ/kimlik doğrulama hatası | Yerel korunur | `error` (`retryable`) |

Revizyon kuralları:

- **Sunucu revizyonu otoritedir.** Başarılı commit sonrası `local.revision =
  response.revision`.
- Commit yalnız `baseRevision === server revision` iken kabul edilir; kontrol
  SQL içinde atomiktir (`UPDATE ... WHERE revision = base_revision`).
- `nextRevision()` yalnız sunucusuz/yerel modda kullanılır; sunucu varken
  revizyon sunucudan gelir.
- Eşitlik "güncel"dir; `canFastForward` **strictly greater** ister.

Çakışma seçenekleri (`ConflictChoice`):

| Seçim | Etki |
| --- | --- |
| `cloud` | Yerel kayıt bulutla değiştirilir (`cloud-loaded`). |
| `local` | Bulut revizyonunun üstüne yeni revizyon olarak yazılır (kullanıcı onayı). |
| `merge` | Kütüphane birleşimi + **defter birleşimi** (`(source, sourceId)` tekil, `amount` yeniden hesaplanır) yeni revizyon. |
| `later` | Yerel kalır, senkron ertelenir; tekrar denenir. |

Birleştirme (merge) defter kuralı: iki defterin birleşimi `source+sourceId`
ile tekilleştirilir; aynı anahtar iki tarafta da varsa **aynı `amount`**
beklenir (yoksa sunucu kopyası kazanır ve `adjustment` ile fark kapatılır).

---

## 4. SQL sözleşmesi (isimler sabit)

Bu fazda SQL **değiştirilmez**; aşağıdaki isimler uygulama fazında beklenecek:

| Nesne | Beklenen sözleşme |
| --- | --- |
| `app_saves` (tablo) | `owner_agent_id text PK`, `revision int`, `updated_at timestamptz`, `device_id text`, `save_hash text`, `payload jsonb`, `schema_version int` |
| `sync_get_state(owner_agent_id text)` | Kaydı döner: `revision`, `updated_at`, `device_id`, `save_hash`, `payload`. Kayıt yoksa boş küme. |
| `sync_commit(owner_agent_id text, base_revision int, device_id text, save_hash text, payload jsonb)` | Atomik: `base_revision` mevcut revizyona eşitse `revision + 1` yazıp yeni revizyonu döner; değilse `{ status: 'conflict', revision }`. `base_revision = 0` yalnız kayıt yokken kabul edilir. |

`payload` içindeki `schemaVersion` `SAVE_SCHEMA_VERSION` (3) değilse istemci
kaydı uygulamaz. `saveHash` sunucuda `payload`'dan yeniden hesaplanmaz
(pahalı); istemci hash'i zarf ile gönderir, sunucu yalnız değişiklik
karşılaştırması için saklar. Bu yüzden **zarf hash'i daima
`makeSaveHash(payload)`'dur** (`buildSaveEnvelope` bunu garanti eder).

---

## 5. Uygulama sırasında uyulacak arabirim kararları

1. `totalXp`/`level` hiçbir yerde kalıcı yazılmaz; selector
   `summarizeXpLedger(state.xpEvents)` üzerinden türetir.
2. Başarım/görev ödülü yazımı `hasXpEvent` kontrolünden geçer; çift toast/XP
   aynı `(source, sourceId)` sayesinde imkânsızdır.
3. `buildSyncSummary` çakışma diyaloğunun tek veri kaynağıdır (UI hesap
   yapmaz).
4. Hash fonksiyonu değiştirilirse tüm cihazlar bir kez tam senkron yapar;
   `saveHash` öneki (`fnv1a-`) sürüm ayrımı için korunur.
