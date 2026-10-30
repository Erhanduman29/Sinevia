-- ============================================================
-- 010 — Push VAPID açık anahtarını sunucudan yayınla
-- ============================================================
-- Neden?
--   İstemci anahtarı build sırasında (VITE_VAPID_PUBLIC_KEY) gömülüyordu.
--   Vercel'deki değer ile Edge Function secret'ı farklı olduğunda push
--   servisi her isteği 400 ile reddediyor ve hiçbir bildirim düşmüyordu.
--
--   Artık istemci anahtarı bu tablodan okur. Tek doğru kaynak veritabanıdır;
--   ortam değişkeni yanlış/eski olsa bile abonelikler doğru anahtarla kurulur.
--
--   Anahtar değiştirilirse: bu dosyadaki değeri güncelle, `supabase db push`
--   çalıştır ve Edge Function secret'larını (VAPID_PUBLIC_KEY,
--   VAPID_PRIVATE_KEY) aynı anahtarla güncelle.
-- ============================================================

create table if not exists public.push_config (
  id smallint primary key default 1,
  vapid_public_key text not null,
  updated_at timestamptz not null default now(),
  constraint push_config_single_row check (id = 1)
);

alter table public.push_config enable row level security;

drop policy if exists "push_config_read" on public.push_config;
create policy "push_config_read"
  on public.push_config
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.push_config from anon, authenticated;
grant select on public.push_config to anon, authenticated;

insert into public.push_config (id, vapid_public_key)
values (1, 'BCZIEjTCuV3saXPGXvrw2WB60vRCchlzSNTsYgk2Qmv6Yf1YeTbkQkrZOEN8D8ehAOIFdVa5rZlPovlOF9nDe6U')
on conflict (id) do update
  set vapid_public_key = excluded.vapid_public_key,
      updated_at = now();

-- Doğrulama
select id, vapid_public_key, updated_at from public.push_config;
