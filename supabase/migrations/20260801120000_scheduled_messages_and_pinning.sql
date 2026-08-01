-- Scheduled messages: a message row is created immediately at "send later"
-- time, but stays invisible to everyone (including the sender's other
-- devices) until scheduled_at passes — visible_messages already handles
-- expiry filtering for disappearing messages, so we extend it to also
-- filter out not-yet-due scheduled messages, reusing the same mechanism.
alter table public.messages add column if not exists scheduled_at timestamptz;

create or replace view public.visible_messages
  with (security_invoker = true)
  as
  select * from public.messages
  where (expires_at is null or expires_at > now())
    and (scheduled_at is null or scheduled_at <= now());

grant select on public.visible_messages to authenticated;

-- Per-user chat pinning. This lives on chat_members (not chats) because
-- pinning is a personal preference — one person pinning a shared group
-- chat shouldn't pin it for everyone else in that chat.
alter table public.chat_members add column if not exists is_pinned boolean not null default false;
alter table public.chat_members add column if not exists pinned_at timestamptz;
