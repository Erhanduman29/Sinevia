-- ============================================================================
# SINEVIA — Supabase Ağ Hatası Düzeltme SQL'i
# Bu dosyayı Supabase Dashboard > SQL Editor'de çalıştırın.
# ============================================================================

-- 1. PostgREST şema önbelleğini yenile (notify_poll için gerekli)
notify pgrst, 'reload schema';

-- ============================================================================
-- 2) notify_poll fonksiyonu (tek çağrıda 3 bildirim sorgusu)
-- ============================================================================
create or replace function public.notify_poll(p_agent_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'friendships', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at desc)
      from public.friendships f
      where f.requester_id = p_agent_id or f.receiver_id = p_agent_id
    ), '[]'::jsonb),
    'recommendations', coalesce((
      select jsonb_agg(to_jsonb(r)) from (
        select * from public.recommendations r
        where r.receiver_id = p_agent_id or r.sender_id = p_agent_id
        order by r.created_at desc limit 100
      ) r
    ), '[]'::jsonb),
    'unread_messages', coalesce((
      select jsonb_object_agg(sender_id, cnt)
      from (
        select sender_id, count(*)::int as cnt
        from public.messages
        where receiver_id = p_agent_id
          and is_read = false
          and group_id is null
        group by sender_id
      ) m
    ), '{}'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.notify_poll(text) from public;
grant execute on function public.notify_poll(text) to anon, authenticated;

-- ============================================================================
-- 3) RLS politikaları — YALNIZ kendi kayıtları (güvenli sürüm)
--    NOT: Daha önce eklenen "*_select_public" politikaları burada KALDIRILIR.
--    current_agent_id() NULL ise hiçbir satır dönmez (veri sızmaz).
-- ============================================================================

-- FRIENDSHIPS
drop policy if exists friendships_select_public on public.friendships;
drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own
  on public.friendships for select
  to anon, authenticated
  using (requester_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- RECOMMENDATIONS
drop policy if exists recommendations_select_public on public.recommendations;
drop policy if exists recommendations_select_own on public.recommendations;
create policy recommendations_select_own
  on public.recommendations for select
  to anon, authenticated
  using (sender_id = public.current_agent_id() or receiver_id = public.current_agent_id());

-- MESSAGES
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
-- 4) Şema önbelleğini yeniden yenile
-- ============================================================================
notify pgrst, 'reload schema';

-- ============================================================================
-- TAMAMLANDI — Sayfayı yenileyin (F5) ve tekrar deneyin.
-- ============================================================================
