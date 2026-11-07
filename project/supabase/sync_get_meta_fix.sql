-- ============================================================================
-- SINEVIA — sync_get_meta düzeltmesi (TEK FONKSİYON)
-- Hata: 42804 "COALESCE types timestamp with time zone and text cannot be matched"
-- Sebep: eski sürümde  coalesce(s.updated_at, to_char(...))  yazıyordu; tipler uyuşmuyor.
-- Bu dosyayı Supabase Dashboard > SQL Editor'de çalıştırın. Başka adım gerekmez.
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
