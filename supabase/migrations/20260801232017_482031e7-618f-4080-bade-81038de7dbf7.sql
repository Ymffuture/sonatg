drop function if exists public.cleanup_expired_messages();

create or replace function public.cleanup_expired_messages()
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.messages
  where expires_at is not null
    and expires_at < now()
    and sender_id = auth.uid();
$$;

revoke all on function public.cleanup_expired_messages() from public, anon;
grant execute on function public.cleanup_expired_messages() to authenticated;