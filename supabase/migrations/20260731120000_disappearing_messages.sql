-- Disappearing messages, WhatsApp-style: a chat-level duration setting;
-- new messages sent while it's active get an expires_at stamp computed at
-- insert time. Expired messages are excluded from normal reads immediately
-- (so they visually "disappear" right on schedule), and a cleanup function
-- physically deletes them afterwards to actually free storage.

alter table public.chats add column if not exists disappearing_seconds integer;
alter table public.messages add column if not exists expires_at timestamptz;

-- Regular SELECT policies already restrict messages to chat members; this
-- just filters out expired rows so clients don't need to remember to add
-- an `expires_at > now()` clause everywhere themselves. A view is simpler
-- and safer than trying to bake this into the RLS policy itself, since RLS
-- policies apply to the base table and app code may still want direct
-- table access for inserts/updates.
-- security_invoker = true is critical here: without it, this view would
-- run with the *view owner's* privileges (typically a role with RLS
-- bypass in Supabase), silently defeating the messages table's RLS
-- policies and exposing every chat's messages to every authenticated
-- user. With it, the view enforces RLS as the querying user, exactly
-- like querying the base table directly.
create or replace view public.visible_messages
  with (security_invoker = true)
  as
  select * from public.messages
  where expires_at is null or expires_at > now();

grant select on public.visible_messages to authenticated;

-- Physically removes expired messages (and their reactions/reads via the
-- existing cascade). SECURITY DEFINER so it can delete rows regardless of
-- whose message it is — a regular user's RLS grants only cover deleting
-- their OWN messages, but a disappearing chat needs everyone's expired
-- messages cleaned up, not just the current caller's.
create or replace function public.cleanup_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.messages where expires_at is not null and expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- Only callable by authenticated users (not anon) — still runs with the
-- function owner's privileges (security definer), but at least requires
-- being logged in to trigger it.
revoke all on function public.cleanup_expired_messages() from public;
grant execute on function public.cleanup_expired_messages() to authenticated;
