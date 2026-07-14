
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_chat_last_message() from public, anon, authenticated;
revoke execute on function public.is_chat_member(uuid, uuid) from public, anon;
-- authenticated needs execute so RLS policy subquery works
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;
