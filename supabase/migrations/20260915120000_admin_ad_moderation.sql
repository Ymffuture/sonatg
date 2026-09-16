-- Lets admins see and take down "ad" messages (see
-- 20260915090000_business_accounts_and_ads.sql) across every chat, not just
-- ones they happen to be a member of, for the new Admin console "Ads" tab.
--
-- Two pieces, both scoped narrowly to kind = 'ad' rather than opening up
-- messages in general:
--   1. An extra permissive SELECT policy so admins can read ad rows.
--   2. A security-definer RPC to soft-delete an ad (mirrors the existing
--      admin_delete_report / admin_delete_user pattern — admin destructive
--      actions go through an RPC that checks has_role() itself, rather than
--      a raw table update reachable from any authenticated update policy).

drop policy if exists "admins can read ad messages" on public.messages;
create policy "admins can read ad messages"
  on public.messages
  for select
  to authenticated
  using (kind = 'ad' and public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_delete_ad_message(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can remove ads';
  end if;

  update public.messages
  set deleted_at = now(), body = null, media_url = null, ad_title = null, ad_cta_label = null, ad_cta_url = null
  where id = _id and kind = 'ad';
end;
$$;

grant execute on function public.admin_delete_ad_message(uuid) to authenticated;
