-- Admin "delete this user" + automatic 31-day-inactive purge.
--
-- The app's tables were built up over ~30 migrations with inconsistent FK
-- cascade rules (some columns reference auth.users(id) on delete cascade,
-- most are just raw uuid columns with no FK at all — see chat_members.user_id,
-- messages.sender_id, reactions.user_id, etc). Relying on `delete from
-- auth.users` alone to cascade-clean everything would silently leave rows
-- behind in every table that lacks a real FK, and would hard-fail on the
-- handful of columns that DO have a non-cascading FK to auth.users
-- (messages.pinned_by, moderation_flags.reviewed_by, app_announcements.created_by).
--
-- public.admin_purge_user_data() is therefore an explicit, exhaustive wipe:
-- it walks every table that stores this user's content/activity, in an
-- order that respects existing FKs, then deletes the profile and finally
-- the auth.users row itself (which still cascades the few FK-backed tables
-- as a belt-and-suspenders cleanup, and auto-nulls blog_posts.author_id via
-- its existing ON DELETE SET NULL).
--
-- Storage caveat: the DELETE FROM storage.objects calls below remove the
-- object *metadata* rows (so the files stop showing up / being served),
-- but Postgres alone cannot reach into the S3-compatible backing store —
-- actually freeing that disk space needs a follow-up call to the Storage
-- API (supabase.storage.from(bucket).remove(paths)) from a service-role
-- context, e.g. a small Edge Function. Wire one up if reclaiming storage
-- bytes matters to you; the metadata cleanup here is what makes the user's
-- media disappear from the app immediately either way.

create or replace function public.admin_purge_user_data(_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _target is null then
    raise exception 'admin_purge_user_data: _target is required';
  end if;

  -- Never allow this to touch the seeded Sona AI system profile.
  if _target = '00000000-0000-0000-0000-00000000a1a1' then
    raise exception 'Cannot delete the system AI account.';
  end if;

  -- ── storage object metadata (see caveat above) ──────────────────────
  delete from storage.objects
    where bucket_id = 'chat-media' and split_part(name, '/', 2) = _target::text;
  delete from storage.objects
    where bucket_id = 'statuses' and split_part(name, '/', 1) = _target::text;

  -- ── null out non-cascading FKs on rows this user doesn't own ────────
  update public.messages set pinned_by = null, pinned_at = null where pinned_by = _target;
  update public.moderation_flags set reviewed_by = null, reviewed_at = null where reviewed_by = _target;
  update public.user_moderation set created_by = null where created_by = _target;
  update public.org_invites set invited_by = null where invited_by = _target;
  update public.org_domains set created_by = null where created_by = _target;

  -- ── this user's own activity across every feature table ────────────
  delete from public.reactions where user_id = _target;
  delete from public.message_reads where user_id = _target;
  delete from public.message_bookmarks where user_id = _target;
  delete from public.poll_votes where user_id = _target;
  delete from public.polls where created_by = _target;              -- cascades poll_options/poll_votes
  delete from public.status_views where viewer_id = _target;
  delete from public.statuses where user_id = _target;               -- cascades their status_views
  delete from public.chat_clears where user_id = _target;
  delete from public.notification_preferences where user_id = _target;
  delete from public.subscriptions where user_id = _target;
  delete from public.blocks where blocker_id = _target or blocked_id = _target;
  delete from public.user_moderation where user_id = _target;        -- moderation history *of* this user
  delete from public.reports where reporter_id = _target or reported_id = _target;
  delete from public.moderation_flags where sender_id = _target;
  delete from public.user_roles where user_id = _target;
  delete from public.app_announcements where created_by = _target;   -- created_by is NOT NULL, can't null it out
  delete from public.broadcast_posters where user_id = _target;

  -- their messages — cascades reactions/message_reads/message_bookmarks
  -- for those specific messages, and nulls out any poll's message_id link
  delete from public.messages where sender_id = _target;

  -- leave every chat they were a member of
  delete from public.chat_members where user_id = _target;

  -- tidy up chats now left with nobody in them (1:1 DMs, their personal
  -- Sona AI chat, empty groups) — cascades that chat's own messages,
  -- classes, polls, chat_invites, moderation_flags, broadcast_posters
  delete from public.chats c
    where not exists (select 1 from public.chat_members cm where cm.chat_id = c.id);

  -- the profile row
  delete from public.profiles where id = _target;

  -- the actual account. Cascades whatever FK-backed tables remain
  -- (blocks/subscriptions/statuses/etc already emptied above, so this is
  -- mostly a formality) and auto-nulls blog_posts.author_id.
  delete from auth.users where id = _target;
end;
$$;

-- Not directly callable by anyone — only via the admin-gated wrapper below,
-- or from the scheduled purge job (which runs as the function owner).
revoke all on function public.admin_purge_user_data(uuid) from public, anon, authenticated;

-- ── admin-facing entry point ──────────────────────────────────────────
create or replace function public.admin_delete_user(_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can delete a user''s data.';
  end if;
  if _target = auth.uid() then
    raise exception 'Use account settings to delete your own account.';
  end if;
  perform public.admin_purge_user_data(_target);
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- ── automatic 31-day inactivity purge ──────────────────────────────────
-- "Inactive" = profiles.last_seen (bumped every ~45s while a tab is open,
-- see SonaChat.tsx) older than 31 days, or — for accounts that never came
-- back after signup — created more than 31 days ago with no last_seen at
-- all. The Sona AI system profile, admins, and moderators are excluded so
-- this never quietly deletes staff accounts that just haven't opened the
-- app in a month.
create or replace function public.purge_inactive_users()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _target uuid;
  _count integer := 0;
begin
  for _target in
    select p.id
    from public.profiles p
    where p.is_ai = false
      and (
        (p.last_seen is not null and p.last_seen < now() - interval '31 days')
        or (p.last_seen is null and p.created_at < now() - interval '31 days')
      )
      and not public.has_role(p.id, 'admin')
      and not public.has_role(p.id, 'moderator')
  loop
    perform public.admin_purge_user_data(_target);
    _count := _count + 1;
  end loop;
  return _count;
end;
$$;

revoke all on function public.purge_inactive_users() from public, anon, authenticated;

-- Schedule it to run once a day. pg_cron ships with Supabase Postgres —
-- this just needs enabling once.
create extension if not exists pg_cron with schema extensions;

do $$
begin
  perform cron.unschedule('purge-inactive-users-daily');
exception when others then
  null; -- job didn't exist yet, nothing to unschedule
end $$;

select cron.schedule(
  'purge-inactive-users-daily',
  '0 3 * * *', -- 03:00 UTC daily
  $$select public.purge_inactive_users();$$
);
