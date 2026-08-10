-- The messages.kind check constraint was created with only
-- ('text','image','voice'). 'file' and 'call' kinds are already inserted
-- by the app (file attachments, call logs) — this widens the constraint to
-- match reality and adds 'video' for the new video-message feature.
alter table public.messages
  drop constraint if exists messages_kind_check;

alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text','image','voice','file','call','video'));

-- ForwardModal has always inserted `is_forwarded`, but no migration ever
-- added the column — it was relying on it existing manually in the live
-- DB (or silently failing). Add it properly and backfill false so existing
-- rows aren't null. `visible_messages` is `select *` so it picks this up
-- automatically, no view change needed.
alter table public.messages
  add column if not exists is_forwarded boolean not null default false;

-- `profiles` was never added to the realtime publication, so a client
-- subscribing to postgres_changes on it (e.g. to live-update "last seen")
-- would never receive events even though the query itself is valid.
alter publication supabase_realtime add table public.profiles;
