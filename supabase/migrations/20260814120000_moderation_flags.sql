-- Moderation queue for blocked-word alerts + bullying-pattern detection.
-- Populated client-side by src/features/moderation (local engine + AI
-- classifier). Kept as its own table rather than a column on `messages`
-- so a flagged/blocked message that never got inserted (hard-blocked
-- sends) can still be logged for admin visibility.

create table if not exists public.moderation_flags (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  body_snapshot text not null,
  severity text not null check (severity in ('low','medium','high')),
  score numeric not null check (score >= 0 and score <= 1),
  blocked boolean not null default false, -- true = send was prevented, false = allowed but logged
  categories text[] not null default '{}',
  pattern_signals jsonb not null default '[]'::jsonb,
  reviewed boolean not null default false,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists moderation_flags_chat_id_idx on public.moderation_flags(chat_id);
create index if not exists moderation_flags_sender_id_idx on public.moderation_flags(sender_id);
create index if not exists moderation_flags_unreviewed_idx on public.moderation_flags(reviewed) where reviewed = false;

alter table public.moderation_flags enable row level security;

-- Senders can insert their own flag records (client logs its own moderation
-- result at send time) but cannot read, update, or delete them — only
-- admins/moderators can review the queue.
create policy "senders can log their own flags" on public.moderation_flags
  for insert to authenticated
  with check (sender_id = auth.uid());

create policy "admins and moderators view queue" on public.moderation_flags
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

create policy "admins and moderators update queue" on public.moderation_flags
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'moderator'));

create policy "admins manage queue deletes" on public.moderation_flags
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Convenience view for the admin dashboard's moderation queue tab.
create or replace view public.moderation_queue
  with (security_invoker = true)
  as
  select
    f.id, f.chat_id, f.sender_id, f.message_id, f.body_snapshot,
    f.severity, f.score, f.blocked, f.categories, f.pattern_signals,
    f.reviewed, f.reviewed_by, f.reviewed_at, f.created_at,
    p.display_name as sender_display_name
  from public.moderation_flags f
  left join public.profiles p on p.id = f.sender_id
  order by f.created_at desc;

grant select on public.moderation_queue to authenticated;
