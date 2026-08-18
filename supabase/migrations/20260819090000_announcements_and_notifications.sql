-- Three pieces:
--   1. app_announcements — admin-authored banner shown below the search
--      bar (e.g. "We're updating the app — some features may be
--      unavailable"). Only one is "active" at a time; everyone can read
--      the active one, only admins can write.
--   2. notification_preferences — per-user opt-in flags: get an email
--      when a new app-update announcement is posted, and/or get an email
--      when a friend messages you while you're offline.
--   3. A helper the offline-email server function uses to decide "is
--      this user actually offline" from the existing last_seen heartbeat
--      (SonaChat.tsx already bumps this every 45s while the tab is
--      visible — no new presence system needed).

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  notify_subscribers boolean not null default false -- if true, email everyone subscribed to app-update emails when this goes live
);
grant select on public.app_announcements to authenticated;
grant all on public.app_announcements to service_role;
alter table public.app_announcements enable row level security;

create policy "announcements readable by everyone" on public.app_announcements
  for select to authenticated using (true);
create policy "admins manage announcements" on public.app_announcements
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Only one active announcement makes sense for a single banner slot —
-- enforced in the app layer (admin UI deactivates the previous one when
-- posting a new one) rather than a partial unique index, so history of
-- past announcements is kept for the admin to review.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notify_app_updates boolean not null default true,
  notify_offline_messages boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;

create policy "users manage their own notification prefs" on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Called by the offline-email server function (service-role context) to
-- decide whether a user counts as "offline" right now: no heartbeat
-- (profiles.last_seen, already bumped every 45s while a tab is open) in
-- the last 2 minutes.
create or replace function public.is_user_offline(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select last_seen < now() - interval '2 minutes' from public.profiles where id = _user_id),
    true -- no profile / never seen — treat as offline
  )
$$;
