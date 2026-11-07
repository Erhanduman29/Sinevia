-- notify_poll — tek çağrıda 3 bildirim sorgusu (NetworkPage polling optimizasyonu)
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
