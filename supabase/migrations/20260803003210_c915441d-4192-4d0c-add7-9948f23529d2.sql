
-- roles
do $$ begin
  create type public.app_role as enum ('admin','moderator','user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- allowed organization email domains
create table if not exists public.org_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  label text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.org_domains to authenticated;
grant select on public.org_domains to anon;
grant all on public.org_domains to service_role;
alter table public.org_domains enable row level security;
create policy "org domains readable" on public.org_domains for select to authenticated using (true);
create policy "admins manage org domains" on public.org_domains for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- invites
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  domain text,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.org_invites to authenticated;
grant all on public.org_invites to service_role;
alter table public.org_invites enable row level security;
create policy "admins manage invites" on public.org_invites for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- moderation
create table if not exists public.user_moderation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null check (action in ('warn','suspend','ban','clear')),
  reason text,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.user_moderation to authenticated;
grant all on public.user_moderation to service_role;
alter table public.user_moderation enable row level security;
create policy "see own moderation or admin" on public.user_moderation for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins manage moderation" on public.user_moderation for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- admins can manage profiles
create policy "admins update profiles" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- status privacy
alter table public.statuses add column if not exists privacy text not null default 'contacts';
do $$ begin
  alter table public.statuses add constraint statuses_privacy_check check (privacy in ('public','contacts','only_me'));
exception when duplicate_object then null; end $$;

drop policy if exists "statuses readable by chat contacts" on public.statuses;
create policy "statuses readable by privacy" on public.statuses for select to authenticated
using (
  expires_at > now() and (
    user_id = auth.uid()
    or (privacy = 'public')
    or (privacy = 'contacts' and exists (
      select 1 from public.chat_members mine
      join public.chat_members theirs on theirs.chat_id = mine.chat_id
      where mine.user_id = auth.uid() and theirs.user_id = statuses.user_id
    ))
  )
);

-- bootstrap admin
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users
where lower(email) = 'futurekgomotso@gmail.com'
on conflict (user_id, role) do nothing;

create or replace function public.grant_admin_for_seed_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(coalesce(new.email,'')) = 'futurekgomotso@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created_seed_admin on auth.users;
create trigger on_auth_user_created_seed_admin
after insert on auth.users for each row execute function public.grant_admin_for_seed_email();
