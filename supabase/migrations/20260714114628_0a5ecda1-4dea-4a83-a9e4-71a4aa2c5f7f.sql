
-- Extensions
create extension if not exists pgcrypto;

-- Profiles
create table public.profiles (
  id uuid primary key,
  email text,
  display_name text not null default 'Friend',
  avatar_url text,
  is_ai boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Chats
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text,
  created_by uuid,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
grant select, insert, update, delete on public.chats to authenticated;
grant all on public.chats to service_role;
alter table public.chats enable row level security;

-- Members
create table public.chat_members (
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
grant select, insert, delete on public.chat_members to authenticated;
grant all on public.chat_members to service_role;
alter table public.chat_members enable row level security;

-- Security definer helper (avoids recursive RLS)
create or replace function public.is_chat_member(_chat_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members where chat_id = _chat_id and user_id = _user_id)
$$;

create policy "members see own memberships" on public.chat_members for select to authenticated
  using (user_id = auth.uid() or public.is_chat_member(chat_id, auth.uid()));
create policy "members add themselves or by chat member" on public.chat_members for insert to authenticated
  with check (user_id = auth.uid() or public.is_chat_member(chat_id, auth.uid()));
create policy "members remove themselves" on public.chat_members for delete to authenticated
  using (user_id = auth.uid());

create policy "chats visible to members" on public.chats for select to authenticated
  using (public.is_chat_member(id, auth.uid()));
create policy "chats insert by self" on public.chats for insert to authenticated
  with check (created_by = auth.uid());
create policy "chats update by members" on public.chats for update to authenticated
  using (public.is_chat_member(id, auth.uid()));

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null,
  kind text not null default 'text' check (kind in ('text','image','voice')),
  body text,
  media_url text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index messages_chat_created_idx on public.messages(chat_id, created_at);
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "messages read for members" on public.messages for select to authenticated
  using (public.is_chat_member(chat_id, auth.uid()));
create policy "messages insert by member self" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id, auth.uid()));
create policy "messages update by sender" on public.messages for update to authenticated
  using (sender_id = auth.uid());
create policy "messages delete by sender" on public.messages for delete to authenticated
  using (sender_id = auth.uid());

-- Reactions
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);
create index reactions_message_idx on public.reactions(message_id);
grant select, insert, delete on public.reactions to authenticated;
grant all on public.reactions to service_role;
alter table public.reactions enable row level security;
create policy "reactions read for chat members" on public.reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id, auth.uid())));
create policy "reactions insert self member" on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id, auth.uid())));
create policy "reactions delete self" on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.chat_members;
alter table public.messages replica identity full;
alter table public.reactions replica identity full;
alter table public.chats replica identity full;

-- Seed Sona AI system profile
insert into public.profiles (id, email, display_name, is_ai, avatar_url)
values ('00000000-0000-0000-0000-00000000a1a1', 'ai@sona.local', 'Sona AI', true,
  'https://api.dicebear.com/9.x/initials/svg?seed=Sona%20AI&backgroundColor=7DD3FC&textColor=0F172A')
on conflict (id) do nothing;

-- New user trigger: create profile + dedicated AI chat
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_chat_id uuid;
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1), 'Friend'),
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/9.x/initials/svg?seed=' || replace(coalesce(new.email,'user'),'@','_'))
  ) on conflict (id) do nothing;

  -- Personal AI chat
  insert into public.chats (is_group, title, created_by) values (false, 'Sona AI', new.id) returning id into new_chat_id;
  insert into public.chat_members (chat_id, user_id) values (new_chat_id, new.id), (new_chat_id, '00000000-0000-0000-0000-00000000a1a1');
  insert into public.messages (chat_id, sender_id, kind, body)
  values (new_chat_id, '00000000-0000-0000-0000-00000000a1a1', 'text',
    'Hi! I''m Sona AI ✨ Ask me anything — or type @sona in any chat to summon me.');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bump chat.last_message_at on new message
create or replace function public.touch_chat_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chats set last_message_at = new.created_at where id = new.chat_id;
  return new;
end; $$;
create trigger messages_touch_chat after insert on public.messages
  for each row execute function public.touch_chat_last_message();
