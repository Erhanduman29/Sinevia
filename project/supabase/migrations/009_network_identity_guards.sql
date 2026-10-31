-- 009_network_identity_guards.sql
--
-- 007_network_identity.sql ile public.current_agent_id() çoklu cihaz ve
-- çoklu hesap destekli hale geldi (x-network-session -> network_sessions ->
-- profiles.secret_token -> network_devices).
--
-- Ancak 002_security.sql içindeki iki trigger hâlâ ham cihaz anahtarını
-- (x-agent-token) doğrudan profiles.secret_token ile karşılaştırıyordu:
--
--   * trg_verify_message_sender  (messages INSERT)
--   * trg_verify_group_deletion  (chat_groups DELETE)
--
-- Sonuç: kendi ana cihazı dışında bir cihazdan veya ikinci hesaptan mesaj
-- göndermek "Güvenlik ihlali" hatasıyla reddediliyordu. İstemci bu hatayı
-- göstermediği için mesaj yazılmış gibi görünüyor, sayfa yenilenince
-- kayboluyordu. Bu dosya iki trigger'ı da current_agent_id() üzerinden
-- çalışacak şekilde yeniden tanımlar.

create or replace function public.verify_message_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text;
  v_role text;
  v_actor text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null and v_claims <> '' then
    begin
      v_role := v_claims::json ->> 'role';
    exception when others then
      v_role := '';
    end;
    if v_role = 'service_role' then
      return new;
    end if;
  end if;

  -- 007 sayesinde bu değer oturum token'ı, profil anahtarı veya kayıtlı
  -- cihaz anahtarı üzerinden çözülür.
  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> new.sender_id then
    raise exception 'Güvenlik ihlali: başka bir ajan adına mesaj gönderemezsiniz.';
  end if;

  return new;
end;
$$;

create or replace function public.verify_group_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claims text;
  v_role text;
  v_actor text;
begin
  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is not null and v_claims <> '' then
    begin
      v_role := v_claims::json ->> 'role';
    exception when others then
      v_role := '';
    end;
    if v_role = 'service_role' then
      return old;
    end if;
  end if;

  v_actor := public.current_agent_id();
  if v_actor is not null and v_actor <> old.created_by then
    raise exception 'Güvenlik ihlali: sadece grup kurucusu grubu silebilir.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_verify_message_sender on public.messages;
create trigger trg_verify_message_sender
  before insert on public.messages
  for each row execute function public.verify_message_sender();

drop trigger if exists trg_verify_group_deletion on public.chat_groups;
create trigger trg_verify_group_deletion
  before delete on public.chat_groups
  for each row execute function public.verify_group_deletion();

-- Doğrulama: iki trigger da yerinde olmalı.
select tgname, tgrelid::regclass as tablo
from pg_trigger
where tgname in ('trg_verify_message_sender', 'trg_verify_group_deletion')
order by tgname;
