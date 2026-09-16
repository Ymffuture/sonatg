-- Lets an admin manually grant (or revoke) verified-business status on a
-- profile — e.g. comping an account, or fixing one up after a payment
-- provider hiccup — without touching the database directly. Mirrors
-- admin_delete_ad_message from 20260915120000_admin_ad_moderation.sql:
-- a security-definer RPC that checks has_role() itself, so this is safe to
-- call from a plain authenticated client rather than needing the
-- service-role key in the browser.

create or replace function public.admin_set_business(_target uuid, _value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can change business verification';
  end if;

  update public.profiles set is_business = _value where id = _target;
end;
$$;

grant execute on function public.admin_set_business(uuid, boolean) to authenticated;
