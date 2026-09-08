CREATE OR REPLACE FUNCTION public.admin_delete_report(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.reports WHERE id = _id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_old_reports(_older_than_days integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.reports
   WHERE status IN ('resolved','dismissed')
     AND created_at < now() - make_interval(days => GREATEST(_older_than_days, 0));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_moderation_flag(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.moderation_flags WHERE id = _id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_old_moderation_flags(_older_than_days integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.moderation_flags
   WHERE reviewed = true
     AND created_at < now() - make_interval(days => GREATEST(_older_than_days, 0));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.admin_delete_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_old_reports(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_moderation_flag(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_old_moderation_flags(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_old_reports(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_moderation_flag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_old_moderation_flags(integer) TO authenticated;