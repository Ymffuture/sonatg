alter table public.profiles add column if not exists is_business boolean not null default false;

alter table public.messages
  add column if not exists ad_title text,
  add column if not exists ad_cta_label text,
  add column if not exists ad_cta_url text;

drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(profile_id uuid)
returns table (id uuid, display_name text, avatar_url text, bio text, is_pro boolean, is_ai boolean, is_business boolean, facebook_url text, x_url text, instagram_url text, threads_url text)
language sql security definer set search_path = public stable
as $$
  select p.id, p.display_name, p.avatar_url, p.bio, p.is_pro, p.is_ai, p.is_business, p.facebook_url, p.x_url, p.instagram_url, p.threads_url
  from public.profiles p where p.id = profile_id;
$$;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

drop policy if exists "business accounts can send ad messages" on public.messages;
create policy "business accounts can send ad messages" on public.messages as restrictive for insert
  with check (kind <> 'ad' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_business = true));

drop policy if exists "admins can read ad messages" on public.messages;
create policy "admins can read ad messages" on public.messages for select to authenticated
  using (kind = 'ad' and public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_delete_ad_message(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only admins can remove ads'; end if;
  update public.messages set deleted_at = now(), body = null, media_url = null, ad_title = null, ad_cta_label = null, ad_cta_url = null
  where id = _id and kind = 'ad';
end; $$;
grant execute on function public.admin_delete_ad_message(uuid) to authenticated;

create or replace function public.admin_set_business(_target uuid, _value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only admins can change business verification'; end if;
  update public.profiles set is_business = _value where id = _target;
end; $$;
grant execute on function public.admin_set_business(uuid, boolean) to authenticated;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind = any (array['text','image','voice','file','call','video','poll','system','ad']));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  plan text not null default 'pro',
  billing_interval text not null default 'monthly',
  amount_cents integer not null,
  currency text not null default 'ZAR',
  status text not null default 'paid',
  reference text,
  created_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "own payments read" on public.payments for select to authenticated using (user_id = auth.uid());
create index if not exists payments_user_idx on public.payments(user_id, created_at desc);