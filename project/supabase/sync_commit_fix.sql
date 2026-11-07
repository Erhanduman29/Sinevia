-- ============================================================================
-- SINEVIA — sync_commit v2 (gzip + özet) + eski imza uyumluluğu
-- Bu dosyayı Supabase Dashboard > SQL Editor'de bir kez çalıştırın.
--
-- NEDEN: Sunucuda yalnız eski 5 parametreli sync_commit var. İstemci
-- p_payload_gz / p_summary de gönderdiği için PostgREST PGRST202 (404)
-- dönüyor, senkron duruyor ve arayüz "Bağlantı Yok" gösteriyordu.
-- ============================================================================

-- 1) Eksik kolon: sync_commit bu kolona yazıyor ama canlı şemada yoktu
--    (hata 42703: column "payload_gz" of relation "app_saves" does not exist).
alter table public.app_saves add column if not exists payload_gz bytea;

-- 1b) Gzip kopyaları hiçbir okuma yolunda kullanılmıyor (sync_get_state düz
--     `payload` döner). Eski sürümlerin bıraktığı kopyaları temizleyerek
--     diski geri kazan.
update public.app_saves set payload_gz = null where payload_gz is not null;

create or replace function public.sync_commit(
  p_agent_id text,
  p_base_revision bigint,
  p_device_id text,
  p_save_hash text,
  p_payload jsonb,
  p_payload_gz bytea default null,
  p_summary jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent text := btrim(coalesce(p_agent_id, ''));
  v_actor text;
  v_revision bigint;
  v_next bigint;
  v_now timestamptz := now();
  v_total_xp numeric := 0;
  v_level integer;
  v_movies integer := 0;
  v_past_movies integer := 0;
  v_series integer := 0;
  v_episodes integer := 0;
  v_achievements integer := 0;
  v_quests integer := 0;
begin
  -- 1) Girdi doğrulama ------------------------------------------------
  if v_agent = '' then
    raise exception 'sync_commit: p_agent_id zorunlu.';
  end if;
  if p_base_revision is null or p_base_revision < 0 then
    raise exception 'sync_commit: p_base_revision 0 veya daha büyük olmalı.';
  end if;
  if p_save_hash is null or btrim(p_save_hash) = '' then
    raise exception 'sync_commit: p_save_hash zorunlu.';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'sync_commit: p_payload JSON nesnesi olmalı.';
  end if;

  -- 2) Sahiplik: kimlik çözülebiliyorsa kayıt sahibiyle eşleşmeli ------
  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> v_agent then
    raise exception 'sync_commit: bu kayıt başka bir ajana ait (yetkisiz).';
  end if;

  -- 3) profiles özeti: p_summary varsa doğrudan kullan (payload dizi
  --    dolaşımından kaçın → CPU tasarrufu). Yoksa payload'dan türet (eski
  --    istemciler için uyumluluk).
  if p_summary is not null and jsonb_typeof(p_summary) = 'object' then
    v_total_xp := coalesce((p_summary->>'total_xp')::numeric, 0);
    v_level := greatest(1, coalesce((p_summary->>'level')::integer, 1));
    v_movies := coalesce((p_summary->>'movies_watched')::integer, 0);
    v_past_movies := coalesce((p_summary->>'past_movies_watched')::integer, 0);
    v_series := coalesce((p_summary->>'series_watched')::integer, 0);
    v_episodes := coalesce((p_summary->>'episodes_watched')::integer, 0);
    v_achievements := coalesce((p_summary->>'achievements_unlocked')::integer, 0);
    v_quests := coalesce((p_summary->>'quests_completed')::integer, 0);
  else
    -- 3a) Eski yol: payload'dan hesapla (geri uyumluluk).
    --    total_xp: payload.totalXp (sayı ise) yoksa xpEvents.amount toplamı.
  if jsonb_typeof(p_payload->'totalXp') = 'number' then
    v_total_xp := (p_payload->>'totalXp')::numeric;
  elsif jsonb_typeof(p_payload->'xpEvents') = 'array' then
    select coalesce(sum(
             case when jsonb_typeof(x->'amount') = 'number'
                  then (x->>'amount')::numeric
                  else 0 end
           ), 0)
    into v_total_xp
    from jsonb_array_elements(p_payload->'xpEvents') x;
  else
    v_total_xp := 0;
  end if;
  v_total_xp := greatest(0, round(v_total_xp));

  -- level: payload.level (sayı ise). Yoksa mevcut level korunur.
  -- AppStateV3 has NO level field: level is DERIVED from total XP with the
  -- same arithmetic as src/lib/xp.ts (L2 = 250, each next level +25).
  -- cumulative(L) = 12.5*L^2 + 212.5*L - 225  =>  closed form below.
  v_level := greatest(1, floor(
    (-212.5 + sqrt(45156.25 + 50 * (225 + v_total_xp))) / 25
  )::integer);

  -- movies: watched = true; isPastWatch = true olanlar "önceki film".
  if jsonb_typeof(p_payload->'movies') = 'array' then
    select
      count(*) filter (
        where lower(coalesce(m->>'watched', 'false')) in ('true', '1')
          and lower(coalesce(m->>'isPastWatch', 'false')) not in ('true', '1')
      ),
      count(*) filter (
        where lower(coalesce(m->>'watched', 'false')) in ('true', '1')
          and lower(coalesce(m->>'isPastWatch', 'false')) in ('true', '1')
      )
    into v_movies, v_past_movies
    from jsonb_array_elements(p_payload->'movies') m;
  end if;

  -- series: tüm bölümleri izlenmiş diziler + toplam izlenen bölüm.
  -- (episodes dizisi boş/eksik olan dizi "tamamlanmış" sayılmaz.)
  if jsonb_typeof(p_payload->'series') = 'array' then
    with s as (
      select s2.value as item, s2.ordinality as idx
      from jsonb_array_elements(p_payload->'series') with ordinality as s2(value, ordinality)
    ),
    e as (
      select s.idx,
             count(ep)::integer as total,
             count(ep) filter (
               where lower(coalesce(ep->>'watched', 'false')) in ('true', '1')
             )::integer as watched
      from s
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(s.item->'episodes') = 'array'
             then s.item->'episodes'
             else '[]'::jsonb end
      ) ep
      group by s.idx
    )
    select
      coalesce(count(*) filter (where e.total > 0 and e.watched = e.total), 0),
      coalesce(sum(e.watched), 0)
    into v_series, v_episodes
    from e;
  end if;

  -- achievements: açılan kademe sayısı (unlockedTiers uzunlukları toplamı).
  if jsonb_typeof(p_payload->'achievements') = 'array' then
    select coalesce(sum(
             case when jsonb_typeof(a->'unlockedTiers') = 'array'
                  then jsonb_array_length(a->'unlockedTiers')
                  else 0 end
           ), 0)
    into v_achievements
    from jsonb_array_elements(p_payload->'achievements') a;
  end if;

  -- quests: completedQuests uzunluğu (XP kaynağı DEĞİL, yalnız sayaç).
  if jsonb_typeof(p_payload->'quests'->'completedQuests') = 'array' then
    v_quests := jsonb_array_length(p_payload->'quests'->'completedQuests');
  end if;
  end if;

  -- 4) Satırı kilitle ve revizyon kuralını uygula -----------------------
  select s.revision into v_revision
  from public.app_saves s
  where s.agent_id = v_agent
  for update;

  if not found then
    -- Kayıt yok: yalnızca base_revision = 0 kabul edilir (yarış koşulu yok).
    if p_base_revision <> 0 then
      return jsonb_build_object(
        'status', 'conflict',
        'revision', 0,
        'reason', 'no-record'
      );
    end if;

    v_next := 1;

    insert into public.app_saves (agent_id, revision, save_hash, payload, payload_gz, device_id, updated_at)
    values (v_agent, v_next, btrim(p_save_hash), p_payload, p_payload_gz, nullif(btrim(coalesce(p_device_id, '')), ''), v_now)
    on conflict (agent_id) do nothing;

    if not found then
      -- Aynı anda başka bir commit satırı oluşturdu: çakışma döndür.
      select s.revision into v_revision
      from public.app_saves s
      where s.agent_id = v_agent;

      return jsonb_build_object(
        'status', 'conflict',
        'revision', coalesce(v_revision, 0),
        'reason', 'race'
      );
    end if;
  else
    if p_base_revision <> v_revision then
      return jsonb_build_object(
        'status', 'conflict',
        'revision', v_revision,
        'reason', 'revision-mismatch'
      );
    end if;

    v_next := v_revision + 1;

    update public.app_saves s
    set revision = v_next,
        save_hash = btrim(p_save_hash),
        payload = p_payload,
        payload_gz = p_payload_gz,
        device_id = nullif(btrim(coalesce(p_device_id, '')), ''),
        updated_at = v_now
    where s.agent_id = v_agent;
  end if;

  -- 5) profiles özeti (YALNIZCA var olan satır güncellenir; yeni satır
  --    OLUŞTURULMAZ). Sayaçlar asla aşağı yazılmaz: en büyük değer korunur.
  update public.profiles p
  set total_xp = v_total_xp::integer,
      level = coalesce(v_level, 1),
      movies_watched = greatest(p.movies_watched, v_movies),
      past_movies_watched = greatest(p.past_movies_watched, v_past_movies),
      series_watched = greatest(p.series_watched, v_series),
      episodes_watched = greatest(p.episodes_watched, v_episodes),
      achievements_unlocked = greatest(p.achievements_unlocked, v_achievements),
      quests_completed = greatest(p.quests_completed, v_quests),
      last_seen = case when last_seen < now() - interval '1 hour' then v_now else last_seen end
  where p.agent_id = v_agent;

  -- 6) Başarı yanıtı ----------------------------------------------------
  return jsonb_build_object(
    'status', 'ok',
    'revision', v_next,
    'save_hash', btrim(p_save_hash),
    'updated_at', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- Yeni imza (7 parametre): düz payload + gzip kopya + profil özeti.
revoke all on function public.sync_commit(text, bigint, text, text, jsonb, bytea, jsonb) from public;
grant execute on function public.sync_commit(text, bigint, text, text, jsonb, bytea, jsonb) to anon, authenticated;

comment on function public.sync_commit(text, bigint, text, text, jsonb, bytea, jsonb) is
  'Atomik V3 commit: FOR UPDATE kilidi, base_revision eşleşme şartı, conflict yanıtı ve profiles özet güncellemesi.';

-- Eski 5 parametreli imza KALDIRILIR: 7'li imzada varsayılanlar olduğu için
-- ikisi birlikte PostgREST'te "hangi fonksiyon?" belirsizliği (PGRST203)
-- yaratıyor (canlıda 300 dönüyordu).
drop function if exists public.sync_commit(text, bigint, text, text, jsonb);

-- ============================================================================
-- GÜVENLİK TEMİZLİĞİ
-- Daha önce (yanlış teşhisle) eklenen "oturum yoksa herkese oku" politikaları
-- kaldırılır. Bunlar messages/friendships/recommendations'ı tokensız herkese
-- açıyordu. Doğru politikalar geri konur.
-- ============================================================================
drop policy if exists friendships_select_public on public.friendships;
drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own
  on public.friendships for select
  to anon, authenticated
  using (requester_id = public.current_agent_id() or receiver_id = public.current_agent_id());

drop policy if exists recommendations_select_public on public.recommendations;
drop policy if exists recommendations_select_own on public.recommendations;
create policy recommendations_select_own
  on public.recommendations for select
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

drop policy if exists messages_select_public on public.messages;
drop policy if exists messages_select_own on public.messages;
create policy messages_select_own
  on public.messages for select
  to anon, authenticated
  using (
    sender_id = public.current_agent_id()
    or receiver_id = public.current_agent_id()
    or (group_id is not null and public.is_group_member(group_id, public.current_agent_id()))
  );

-- ============================================================================
-- sync_get_meta düzeltmesi (eski sürüm 42804 tip hatası veriyordu)
-- ============================================================================
create or replace function public.sync_get_meta(p_agent_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_agent text := btrim(coalesce(p_agent_id, ''));
  v_actor text;
  v_revision bigint;
  v_save_hash text;
  v_updated_at timestamptz;
  v_device_id text;
begin
  if v_agent = '' then
    raise exception 'sync_get_meta: p_agent_id zorunlu.';
  end if;

  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> v_agent then
    raise exception 'sync_get_meta: bu kayıt başka bir ajana ait.';
  end if;

  select s.revision, s.save_hash, s.updated_at, s.device_id
  into v_revision, v_save_hash, v_updated_at, v_device_id
  from public.app_saves s
  where s.agent_id = v_agent;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'revision', v_revision,
    'save_hash', v_save_hash,
    'updated_at', to_char(v_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'device_id', v_device_id
  );
end;
$$;

revoke all on function public.sync_get_meta(text) from public;
grant execute on function public.sync_get_meta(text) to anon, authenticated;

notify pgrst, 'reload schema';
