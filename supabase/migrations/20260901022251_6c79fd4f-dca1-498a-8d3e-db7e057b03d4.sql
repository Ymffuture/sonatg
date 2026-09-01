REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_post_in_chat(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_class_join_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_messages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_offline(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_dashboard_stats() TO service_role;