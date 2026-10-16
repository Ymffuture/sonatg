-- Math & physics agents: one row per agent run, holding the "How Sona solved this" trace
-- (plan, calculator checks, solver agreement, corrections). Written by the server with the
-- service role; chat members can read it (RLS), nobody can write it from the client.

create table if not exists public.ai_agent_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  chat_id     uuid not null references public.chats(id) on delete cascade,
  message_id  uuid references public.messages(id) on delete set null,
  subject     text not null check (subject in ('math', 'physics', 'both')),
  level       text not null check (level in ('verified', 'checked', 'unverified')),
  trace       jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists ai_agent_runs_chat_idx on public.ai_agent_runs (chat_id, created_at desc);

alter table public.ai_agent_runs enable row level security;

drop policy if exists "chat members read agent runs" on public.ai_agent_runs;
create policy "chat members read agent runs"
  on public.ai_agent_runs for select to authenticated
  using (user_id = auth.uid() or public.is_chat_member(chat_id, auth.uid()));
