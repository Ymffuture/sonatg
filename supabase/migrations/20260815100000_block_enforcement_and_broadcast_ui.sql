-- Blocking currently only hides the composer client-side (see
-- composerNotice in SonaChat.tsx) — a blocked user could still reach the
-- insert endpoint directly. This makes block enforcement bidirectional at
-- the database layer too: if either party has blocked the other, neither
-- can insert a new message into their shared 1:1 chat. Group chats are
-- unaffected (a block only makes sense between two people in a DM).

create or replace function public.dm_is_blocked(_chat_id uuid, _sender_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.chats c
    join public.chat_members cm on cm.chat_id = c.id and cm.user_id <> _sender_id
    where c.id = _chat_id
      and c.is_group = false
      and (
        exists (select 1 from public.blocks b where b.blocker_id = _sender_id and b.blocked_id = cm.user_id)
        or exists (select 1 from public.blocks b where b.blocker_id = cm.user_id and b.blocked_id = _sender_id)
      )
  )
$$;

drop policy if exists "messages insert by member self" on public.messages;
create policy "messages insert by member self" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_post_in_chat(chat_id, auth.uid())
    and not public.dm_is_blocked(chat_id, auth.uid())
  );
