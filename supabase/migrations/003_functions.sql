-- ============================================================
-- SINEVIA 003 — FONKSİYONLAR
-- ============================================================
-- Bu dosya kendiliğinden veri silmez. Hesap silme yalnızca kullanıcı
-- "hesabımı sil" dediğinde, doğru secret_token ile çalışır.
-- 001 + 002'den sonra uygulanır.
-- ============================================================

begin;

create or replace function public.sinevia_delete_account(p_agent_id text, p_secret text)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_token text;
begin
  if p_agent_id is null or btrim(p_agent_id) = '' then
    raise exception 'unauthorized';
  end if;
  if p_secret is null or btrim(p_secret) = '' then
    raise exception 'unauthorized';
  end if;

  select secret_token into v_token
  from public.profiles
  where agent_id = p_agent_id;

  if v_token is null or btrim(v_token) = '' or v_token <> p_secret then
    raise exception 'unauthorized';
  end if;

  -- Kullanıcının kurduğu grupların mesajları (receiver_id NULL olduğu için
  -- aşağıdaki bireysel mesaj silme adımı bunları kapsamaz).
  delete from public.messages
  where group_id in (
    select id from public.chat_groups where created_by = p_agent_id
  );

  -- Bireysel mesajlar
  delete from public.messages
  where sender_id = p_agent_id or receiver_id = p_agent_id;

  -- Öneriler
  delete from public.recommendations
  where sender_id = p_agent_id or receiver_id = p_agent_id;

  -- Arkadaşlıklar
  delete from public.friendships
  where requester_id = p_agent_id or receiver_id = p_agent_id;

  -- Grup üyelikleri (kurduğu gruplar + üye olduğu gruplar)
  delete from public.chat_group_members
  where group_id in (select id from public.chat_groups where created_by = p_agent_id);
  delete from public.chat_group_members
  where agent_id = p_agent_id;

  -- Gruplar
  delete from public.chat_groups
  where created_by = p_agent_id;

  -- Ağ kayıtları
  delete from public.network_logs
  where agent_id = p_agent_id;

  -- Profil
  delete from public.profiles
  where agent_id = p_agent_id;

  -- Bulut arşivi (varsa)
  delete from storage.objects
  where bucket_id = 'sinevia_saves' and name = p_agent_id || '.json';
end;
$$;

revoke all on function public.sinevia_delete_account(text, text) from public;
grant execute on function public.sinevia_delete_account(text, text) to anon, authenticated;

comment on function public.sinevia_delete_account(text, text) is
  'Kullanıcı hesabını ve ona bağlı ağ verilerini siler. Sadece doğru secret_token ile çalışır.';

commit;
