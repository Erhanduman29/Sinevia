-- ============================================================
-- SINEVIA 008 — PUSH TANILAMA VE UÇTAN UCA TEST
-- ============================================================
-- AMAÇ
--   1) "Uygulama kapalıyken bildirim gelmiyor" sorununu teşhis
--      edilebilir hale getirmek.
--   2) Ayarlar > Bildirimler > "Test Bildirimi Gönder" düğmesinin
--      GERÇEK push göndermesini sağlamak (şimdiye kadar yalnızca
--      uygulama açıkken yerel bildirim gösteriyordu).
--
--   Test, üretimdeki zincirin AYNISINI çalıştırır:
--     RPC -> pg_net -> Edge Function -> VAPID -> cihaz
--   Bu yüzden telefon kapalıyken bile test bildirimi düşer.
--
-- KURAL: Veri silmez. Idempotent.
-- Sıra: 001 -> ... -> 007 -> 008
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) pg_net'i garanti altına al (zaten kuruluysa dokunmaz)
-- ------------------------------------------------------------
do $$
begin
  execute 'create schema if not exists net';
  begin
    execute 'create extension if not exists pg_net with schema net';
  exception when others then
    raise warning 'pg_net etkinleştirilemedi: %', sqlerrm;
  end;
end $$;

-- ------------------------------------------------------------
-- 2) push_pipeline_status() — teşhis bilgisi
--    İstemci: supabase.rpc('push_pipeline_status')
-- ------------------------------------------------------------
create or replace function public.push_pipeline_status()
returns jsonb
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_net_schema text;
  v_triggers int;
  v_responses jsonb := '[]'::jsonb;
  v_agent text;
  v_subs int := 0;
  v_prefs boolean := false;
begin
  select n.nspname into v_net_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'http_post' and n.nspname in ('net', 'extensions')
  limit 1;

  select count(*) into v_triggers
  from pg_trigger
  where tgname in (
    'messages_push_webhook',
    'friendships_push_webhook',
    'recommendations_push_webhook'
  );

  -- Son 5 webhook yanıtı (içerik gönderilmez; yalnızca durum bilgisi)
  if to_regclass('net._http_response') is not null then
    execute $q$
      select coalesce(jsonb_agg(x order by x.created desc), '[]'::jsonb)
      from (
        select status_code,
               error_msg,
               timed_out,
               created,
               left(coalesce(content, ''), 200) as body_preview
        from net._http_response
        order by created desc
        limit 5
      ) x
    $q$ into v_responses;
  end if;

  v_agent := public.current_agent_id();
  if v_agent is not null then
    select count(*) into v_subs from public.push_subscriptions where agent_id = v_agent;
    select exists(
      select 1 from public.network_notification_prefs where agent_id = v_agent
    ) into v_prefs;
  end if;

  return jsonb_build_object(
    'pg_net_schema', v_net_schema,
    'triggers', v_triggers,
    'webhook_configured', exists(select 1 from public.push_webhook_config),
    'agent_id', v_agent,
    'subscriptions', v_subs,
    'prefs_row', v_prefs,
    'recent_responses', v_responses
  );
exception when others then
  return jsonb_build_object('error', sqlerrm);
end;
$$;

-- ------------------------------------------------------------
-- 3) push_self_test() — gerçek uçtan uca test isteği
--    Yalnızca oturum sahibinin kendi cihazlarına gider.
-- ------------------------------------------------------------
create or replace function public.push_self_test()
returns jsonb
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_secret text;
  v_endpoint text;
  v_agent text;
  v_request_id bigint;
  v_body jsonb;
begin
  v_agent := public.current_agent_id();
  if v_agent is null then
    return jsonb_build_object('ok', false, 'reason', 'no_identity');
  end if;

  select secret, endpoint into v_secret, v_endpoint
  from public.push_webhook_config
  where id = true;

  if v_secret is null or v_endpoint is null then
    return jsonb_build_object('ok', false, 'reason', 'no_config');
  end if;

  v_body := jsonb_build_object(
    'table', 'self_test',
    'record', jsonb_build_object('receiver_id', v_agent)
  );

  begin
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'net' and p.proname = 'http_post'
    ) then
      select net.http_post(
        url := v_endpoint,
        body := v_body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_secret
        )
      ) into v_request_id;
    elsif exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'extensions' and p.proname = 'http_post'
    ) then
      select extensions.http_post(
        url := v_endpoint,
        body := v_body,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_secret
        )
      ) into v_request_id;
    else
      return jsonb_build_object('ok', false, 'reason', 'pg_net_missing');
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'reason', 'dispatch_failed', 'detail', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'request_id', v_request_id);
end;
$$;

revoke all on function public.push_pipeline_status() from public;
revoke all on function public.push_self_test() from public;
grant execute on function public.push_pipeline_status() to anon, authenticated;
grant execute on function public.push_self_test() to anon, authenticated;

commit;
