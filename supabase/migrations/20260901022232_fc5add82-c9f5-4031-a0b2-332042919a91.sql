ALTER VIEW public.visible_messages SET (security_invoker = on);
ALTER VIEW public.admin_dashboard_stats SET (security_invoker = on);

REVOKE EXECUTE ON FUNCTION public.generate_class_join_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_class_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_post_in_chat(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_user_offline(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_dashboard_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_dashboard_stats() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_messages() FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_admin_for_seed_email() FROM anon, authenticated;