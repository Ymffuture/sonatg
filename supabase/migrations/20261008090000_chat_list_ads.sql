-- Chat-list ads: sponsored cards shown BETWEEN chats in the chat list.
-- Unlike kind = 'ad' messages (only visible inside one chat), these live in
-- their own table so every signed-in user can see an active ad.

create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  title text not null check (char_length(title) between 1 and 80),
  cta_label text not null check (char_length(cta_label) between 1 and 24),
  cta_url text not null check (cta_url ~* '^https?://'),
  status text not null default 'active' check (status in ('active','paused','removed')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ads_active_idx on public.ads (status, starts_at, ends_at);
create index if not exists ads_owner_idx on public.ads (owner_id, created_at desc);

alter table public.ads enable row level security;

-- Everyone signed in can read live ads.
drop policy if exists "read live ads" on public.ads;
create policy "read live ads" on public.ads for select to authenticated
  using (status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now()));

-- Owners see all of their own ads (any status) and can create / pause them.
drop policy if exists "owners read own ads" on public.ads;
create policy "owners read own ads" on public.ads for select to authenticated
  using (owner_id = auth.uid());

-- Only verified business accounts may create ads.
drop policy if exists "business inserts own ads" on public.ads;
create policy "business inserts own ads" on public.ads for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_business = true)
  );

-- Owners may only toggle active/paused/removed; counters go through the RPC below.
drop policy if exists "owners update own ads" on public.ads;
create policy "owners update own ads" on public.ads for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Admins can read and moderate everything.
drop policy if exists "admins manage ads" on public.ads;
create policy "admins manage ads" on public.ads for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Counters: security definer so viewers can bump them without update rights.
create or replace function public.record_ad_event(_ad_id uuid, _kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if _kind = 'impression' then
    update public.ads set impressions = impressions + 1 where id = _ad_id and status = 'active';
  elsif _kind = 'click' then
    update public.ads set clicks = clicks + 1 where id = _ad_id and status = 'active';
  end if;
end;
$$;

grant execute on function public.record_ad_event(uuid, text) to authenticated;
