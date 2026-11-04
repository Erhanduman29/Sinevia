-- ============================================================
-- Sinevia XP Senkronizasyon Onarım Betiği
-- ============================================================
-- Amaç: profiles.total_xp ve profiles.level değerlerini,
--       app_saves.payload içindeki xpEvents toplamından yeniden hesaplar.
--
-- Kullanım: Supabase Dashboard > SQL Editor'de çalıştırın.
-- ============================================================

-- ------------------------------------------------------------------
-- ADIM 0: app_saves'ta veri var mı? (tanılama)
-- ------------------------------------------------------------------
SELECT 
    COUNT(*) AS app_save_kaydi_sayisi,
    COUNT(*) FILTER (WHERE payload ? 'xpEvents') AS xp_events_li_kayit
FROM app_saves;

-- ------------------------------------------------------------------
-- ADIM 1: Mevcut durumu göster (önce)
-- ------------------------------------------------------------------
SELECT 
    p.agent_id,
    p.nickname,
    p.total_xp AS mevcut_total_xp,
    p.level AS mevcut_level
FROM profiles p
ORDER BY p.total_xp DESC NULLS LAST;

-- ------------------------------------------------------------------
-- ADIM 2: Onarım — profiles.total_xp ve level'ı app_saves'tan hesapla
-- ------------------------------------------------------------------
-- GREATEST kullanılarak mevcut değerler asla düşürülmez (sync_commit ile uyumlu).
-- Level, total_xp üzerinden closed-form ile hesaplanır:
--   floor((-212.5 + sqrt(45156.25 + 50 * (225 + total_xp))) / 25)
--
-- NOT: PostgreSQL'de UPDATE ... FROM ... WHERE kullanilir (ON degil).
-- ------------------------------------------------------------------
UPDATE profiles p
SET 
    total_xp = GREATEST(p.total_xp, COALESCE(sub.calc_total_xp, 0)),
    level = GREATEST(
        p.level,
        COALESCE(
            floor((-212.5 + sqrt(45156.25 + 50 * (225 + GREATEST(p.total_xp, COALESCE(sub.calc_total_xp, 0))))) / 25),
            p.level
        )
    ),
    updated_at = now()
FROM (
    SELECT 
        a.agent_id,
        COALESCE(
            (SELECT SUM((x->>'amount')::numeric) 
             FROM jsonb_array_elements(a.payload->'xpEvents') AS x),
            0
        ) AS calc_total_xp
    FROM app_saves a
    WHERE a.payload ? 'xpEvents'
) sub
WHERE p.agent_id = sub.agent_id;

-- ------------------------------------------------------------------
-- ADIM 3: Sonuçları göster (sonra)
-- ------------------------------------------------------------------
SELECT 
    p.agent_id,
    p.nickname,
    p.total_xp AS guncel_total_xp,
    p.level AS guncel_level,
    p.updated_at AS guncellenme_zamani
FROM profiles p
ORDER BY p.total_xp DESC NULLS LAST;

-- ------------------------------------------------------------------
-- ADIM 4: Değişiklik özeti
-- ------------------------------------------------------------------
SELECT 
    COUNT(*) AS guncellenen_profil_sayisi
FROM profiles p
JOIN app_saves a ON p.agent_id = a.agent_id
WHERE a.payload ? 'xpEvents'
  AND p.total_xp = COALESCE((
      SELECT SUM((x->>'amount')::numeric)
      FROM jsonb_array_elements(a.payload->'xpEvents') AS x
  ), 0);

-- ============================================================
-- ÖNEMLI NOT: Eğer ADIM 0 sonucu app_save_kaydi_sayisi = 0 ise,
--             cloud'da app_saves verisi yoktur (temizlenmis).
--             Bu durumda SQL üzerinden geri getirecek veri yok.
--             HER HESAP icin cihazdaki local veriyi buluta yuklemek
--             gerekir (forceCloudUpload / pushLocal).
-- ============================================================
