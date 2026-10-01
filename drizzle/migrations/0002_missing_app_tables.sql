alter table public.profiles add column if not exists ai_model text;

create table if not exists public.message_deliveries (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  delivered_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
grant select, insert on public.message_deliveries to authenticated;
grant all on public.message_deliveries to service_role;
alter table public.message_deliveries enable row level security;
create policy "deliveries read by members" on public.message_deliveries for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id, auth.uid())));
create policy "deliveries insert self" on public.message_deliveries for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id, auth.uid())));

create table if not exists public.contact_nicknames (
  owner_id uuid not null,
  contact_id uuid not null,
  nickname text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, contact_id)
);
grant select, insert, update, delete on public.contact_nicknames to authenticated;
grant all on public.contact_nicknames to service_role;
alter table public.contact_nicknames enable row level security;
create policy "own nicknames" on public.contact_nicknames for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists public.vouchers (
  code text primary key,
  plan text not null check (plan in ('purple','business')),
  "interval" text not null check ("interval" in ('monthly','yearly')),
  redeemed_by uuid,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.vouchers to authenticated;
grant all on public.vouchers to service_role;
alter table public.vouchers enable row level security;
create policy "Admins can view vouchers" on public.vouchers for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.generate_vouchers(_plan text, _interval text, _count integer, _expires_at timestamptz default null)
returns text[] language plpgsql security definer set search_path = public as $$
declare codes text[] := '{}'; c text; i int;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Only admins can create vouchers'; end if;
  if _count < 1 or _count > 500 then raise exception 'Count must be between 1 and 500'; end if;
  for i in 1.._count loop
    c := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
    insert into public.vouchers(code, plan, "interval", expires_at, created_by) values (c, _plan, _interval, _expires_at, auth.uid());
    codes := array_append(codes, c);
  end loop;
  return codes;
end; $$;
revoke execute on function public.generate_vouchers(text, text, integer, timestamptz) from public, anon;
grant execute on function public.generate_vouchers(text, text, integer, timestamptz) to authenticated;

create or replace function public.redeem_voucher(_code text)
returns table(plan text, "interval" text) language plpgsql security definer set search_path = public as $$
declare v public.vouchers;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v from public.vouchers where code = upper(trim(_code)) for update;
  if not found then raise exception 'That code is not valid.'; end if;
  if v.redeemed_by is not null then raise exception 'That code has already been used.'; end if;
  if v.expires_at is not null and v.expires_at < now() then raise exception 'That code has expired.'; end if;
  update public.vouchers set redeemed_by = auth.uid(), redeemed_at = now() where code = v.code;
  if v.plan = 'business' then
    update public.profiles set is_business = true where id = auth.uid();
  else
    update public.profiles set is_pro = true where id = auth.uid();
    insert into public.subscriptions(user_id, tier, provider, current_period_end, updated_at)
    values (auth.uid(), 'pro', 'voucher', now() + case when v."interval" = 'yearly' then interval '1 year' else interval '1 month' end, now())
    on conflict (user_id) do update set tier='pro', provider='voucher', current_period_end=excluded.current_period_end, updated_at=now();
  end if;
  return query select v.plan, v."interval";
end; $$;
revoke execute on function public.redeem_voucher(text) from public, anon;
grant execute on function public.redeem_voucher(text) to authenticated;