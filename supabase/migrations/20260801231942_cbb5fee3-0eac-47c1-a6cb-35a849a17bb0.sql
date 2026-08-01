-- ── profiles ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists last_seen timestamptz,
  add column if not exists bio text;

-- ── chats ────────────────────────────────────────────────
alter table public.chats
  add column if not exists category text not null default 'general',
  add column if not exists avatar_url text,
  add column if not exists disappearing_seconds integer;

-- ── chat_members ─────────────────────────────────────────
do $$ begin
  create type public.chat_member_role as enum ('admin','member');
exception when duplicate_object then null; end $$;

alter table public.chat_members
  add column if not exists role public.chat_member_role not null default 'member',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

update public.chat_members cm
set role = 'admin'
from public.chats c
where c.id = cm.chat_id and c.created_by = cm.user_id;

-- ── messages ─────────────────────────────────────────────
alter table public.messages
  add column if not exists transcript text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists expires_at timestamptz,
  add column if not exists scheduled_at timestamptz;

create index if not exists messages_expires_at_idx on public.messages (expires_at) where expires_at is not null;
create index if not exists messages_scheduled_at_idx on public.messages (scheduled_at) where scheduled_at is not null;

-- ── statuses ─────────────────────────────────────────────
create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','image','video')),
  body text,
  media_url text,
  media_path text,
  media_provider text not null default 'supabase' check (media_provider in ('supabase','cloudinary')),
  media_public_id text,
  duration_ms integer,
  background_color text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

grant select, insert, update, delete on public.statuses to authenticated;
grant all on public.statuses to service_role;
alter table public.statuses enable row level security;

create policy "statuses readable by chat contacts"
  on public.statuses for select to authenticated
  using (
    expires_at > now()
    and (
      user_id = auth.uid()
      or exists (
        select 1
        from public.chat_members mine
        join public.chat_members theirs on theirs.chat_id = mine.chat_id
        where mine.user_id = auth.uid() and theirs.user_id = public.statuses.user_id
      )
    )
  );

create policy "own statuses insert" on public.statuses for insert to authenticated with check (user_id = auth.uid());
create policy "own statuses update" on public.statuses for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own statuses delete" on public.statuses for delete to authenticated using (user_id = auth.uid());

create index if not exists statuses_user_created_idx on public.statuses (user_id, created_at desc);

-- ── status_views ─────────────────────────────────────────
create table if not exists public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);

grant select, insert, delete on public.status_views to authenticated;
grant all on public.status_views to service_role;
alter table public.status_views enable row level security;

create policy "status views visible to owner and viewer"
  on public.status_views for select to authenticated
  using (
    viewer_id = auth.uid()
    or exists (select 1 from public.statuses s where s.id = status_id and s.user_id = auth.uid())
  );

create policy "record own status view" on public.status_views for insert to authenticated with check (viewer_id = auth.uid());
create policy "remove own status view" on public.status_views for delete to authenticated using (viewer_id = auth.uid());

-- ── visible_messages view (hides expired + not-yet-due) ──
create or replace view public.visible_messages
with (security_invoker = true) as
  select *
  from public.messages m
  where (m.expires_at is null or m.expires_at > now())
    and (m.scheduled_at is null or m.scheduled_at <= now() or m.sender_id = auth.uid());

grant select on public.visible_messages to authenticated;
grant all on public.visible_messages to service_role;

-- ── cleanup function ─────────────────────────────────────
create or replace function public.cleanup_expired_messages()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.messages where expires_at is not null and expires_at < now();
$$;

grant execute on function public.cleanup_expired_messages() to authenticated;

-- ── statuses storage policies ────────────────────────────
create policy "status media readable by authenticated"
  on storage.objects for select to authenticated
  using (bucket_id = 'statuses');

create policy "status media insert own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'statuses' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "status media update own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'statuses' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "status media delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'statuses' and (storage.foldername(name))[1] = auth.uid()::text);