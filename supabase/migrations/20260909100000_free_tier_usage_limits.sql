-- Free-tier usage limits: non-pro ("Purple") users are capped at
--   * 10 chats total (direct + group they created/joined)
--   * 200 messages sent per rolling UTC day
-- Enforced in the database (not just the client) so the limit can't be
-- bypassed by calling the Supabase REST/JS API directly.
-- Mirrors src/lib/planLimits.ts (FREE_CHAT_LIMIT / FREE_DAILY_MESSAGE_LIMIT) —
-- keep both in sync if either number changes.

create or replace function public.enforce_free_chat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_pro_user boolean;
  chat_count integer;
begin
  select coalesce(p.is_pro, false) into is_pro_user
  from public.profiles p
  where p.id = new.user_id;

  -- Pro members are unlimited; also never block if the profile row can't
  -- be found (fail open rather than break onboarding).
  if is_pro_user then
    return new;
  end if;

  select count(*) into chat_count
  from public.chat_members
  where user_id = new.user_id;

  if chat_count >= 10 then
    raise exception 'FREE_TIER_CHAT_LIMIT: Sona Purple members can join or start up to 10 chats. Upgrade to Sona Purple for unlimited chats.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_free_chat_limit on public.chat_members;
create trigger trg_enforce_free_chat_limit
  before insert on public.chat_members
  for each row execute function public.enforce_free_chat_limit();


create or replace function public.enforce_free_message_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_pro_user boolean;
  sent_today integer;
begin
  select coalesce(p.is_pro, false) into is_pro_user
  from public.profiles p
  where p.id = new.sender_id;

  if is_pro_user then
    return new;
  end if;

  -- Sona AI / system messages never count against the human sender's quota.
  if new.sender_id is null then
    return new;
  end if;

  select count(*) into sent_today
  from public.messages
  where sender_id = new.sender_id
    and created_at >= date_trunc('day', now() at time zone 'utc');

  if sent_today >= 200 then
    raise exception 'FREE_TIER_MESSAGE_LIMIT: Sona Purple members can send up to 200 messages per day. Upgrade to Sona Purple for unlimited messaging.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_free_message_limit on public.messages;
create trigger trg_enforce_free_message_limit
  before insert on public.messages
  for each row execute function public.enforce_free_message_limit();
