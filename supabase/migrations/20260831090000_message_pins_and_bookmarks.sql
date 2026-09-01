-- Two related-but-distinct features:
--   1. Message pinning — shared. Pinning a message shows a banner to every
--      member of that chat (like the existing chat_members.is_pinned for
--      pinning a whole *conversation* in the sidebar, but this pins one
--      *message* within a chat). Any member can pin/unpin; who pinned it
--      and when is kept for the banner's "Pinned by ..." caption.
--   2. Bookmarks ("Saved Messages") — personal. A private per-user list of
--      messages, independent of the chat they came from and invisible to
--      everyone else, mirroring Telegram's Saved Messages.

alter table public.messages add column if not exists pinned_by uuid references auth.users(id);
alter table public.messages add column if not exists pinned_at timestamptz;

-- visible_messages (from the disappearing-messages migration) was defined
-- as `select * from public.messages`, and Postgres freezes a view's column
-- list at creation time — the two new columns above won't show up in it
-- until the view is redefined, which is what this does.
create or replace view public.visible_messages
  with (security_invoker = true)
  as
  select * from public.messages
  where expires_at is null or expires_at > now();

grant select on public.visible_messages to authenticated;

-- Only chat members may pin/unpin, and only within chats they belong to.
-- Re-uses the existing "chat members can update messages they can see"
-- surface area, so this is enforced with a dedicated policy scoped to
-- exactly the two pin columns rather than opening up full row updates.
drop policy if exists "chat members can pin messages" on public.messages;
create policy "chat members can pin messages" on public.messages
  for update to authenticated
  using (public.is_chat_member(chat_id, auth.uid()))
  with check (public.is_chat_member(chat_id, auth.uid()));

create table if not exists public.message_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);

create index if not exists message_bookmarks_user_idx on public.message_bookmarks(user_id, created_at desc);

grant select, insert, delete on public.message_bookmarks to authenticated;
grant all on public.message_bookmarks to service_role;
alter table public.message_bookmarks enable row level security;

-- Strictly personal: a bookmark is only ever visible to, and only ever
-- created/removed by, the user who saved it — not the message's other
-- chat members, not even the sender.
create policy "users manage their own bookmarks" on public.message_bookmarks
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id, auth.uid()))
  );
