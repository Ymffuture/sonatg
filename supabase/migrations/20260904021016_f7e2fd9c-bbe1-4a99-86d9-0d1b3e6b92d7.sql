create or replace function public.admin_delete_user(_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only administrators can delete users';
  end if;
  if _target = auth.uid() then
    raise exception 'You cannot delete your own account here';
  end if;
  delete from auth.users where id = _target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;