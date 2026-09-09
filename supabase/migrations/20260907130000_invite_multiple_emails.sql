-- ============================================================================
-- Multi-email invite restriction: an invite link can now be restricted to a
-- LIST of emails instead of just one.
--
-- allowed_email (text) -> allowed_emails (text[]). Existing single-email
-- restrictions are migrated into a one-element array so no data is lost.
-- ============================================================================

ALTER TABLE public.chat_invites ADD COLUMN IF NOT EXISTS allowed_emails text[];

UPDATE public.chat_invites
SET allowed_emails = ARRAY[lower(allowed_email)]
WHERE allowed_email IS NOT NULL AND allowed_emails IS NULL;

ALTER TABLE public.chat_invites DROP COLUMN IF EXISTS allowed_email;

-- preview_chat_invite's return type is changing (allowed_email text ->
-- allowed_emails text[]), and Postgres won't let CREATE OR REPLACE change a
-- table function's column types -- it has to be dropped and recreated.
DROP FUNCTION IF EXISTS public.preview_chat_invite(text);

CREATE FUNCTION public.preview_chat_invite(_token text)
RETURNS TABLE(chat_id uuid, title text, avatar_url text, is_group boolean, allowed_emails text[], is_valid boolean, reason text, already_member boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.chat_invites%ROWTYPE;
  c public.chats%ROWTYPE;
  my_email text;
  ok boolean := true;
  why text := '';
BEGIN
  SELECT * INTO inv FROM public.chat_invites WHERE token = _token;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::text[], false, 'This invite link is not valid.'::text, false;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.chats WHERE id = inv.chat_id;
  my_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  IF NOT inv.is_active THEN ok := false; why := 'This invite link has been revoked.';
  ELSIF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN ok := false; why := 'This invite link has expired.';
  ELSIF inv.max_uses > 0 AND inv.uses >= inv.max_uses THEN ok := false; why := 'This invite link has already been used.';
  ELSIF inv.allowed_emails IS NOT NULL AND array_length(inv.allowed_emails, 1) > 0
        AND NOT (my_email = ANY (inv.allowed_emails)) THEN
    ok := false;
    why := 'This invite is restricted to: ' || array_to_string(inv.allowed_emails, ', ') || '.';
  END IF;

  RETURN QUERY SELECT c.id, c.title, c.avatar_url, c.is_group, inv.allowed_emails, ok, why,
    EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = c.id AND m.user_id = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.preview_chat_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_chat_invite(text) TO authenticated, service_role;

-- join_chat_by_invite's signature/return type is unchanged (still returns
-- uuid), so CREATE OR REPLACE is fine here -- just the allowed_email check
-- inside changes to allowed_emails/ANY.
CREATE OR REPLACE FUNCTION public.join_chat_by_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.chat_invites%ROWTYPE;
  my_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT * INTO inv FROM public.chat_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This invite link is not valid.'; END IF;
  IF NOT inv.is_active THEN RAISE EXCEPTION 'This invite link has been revoked.'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'This invite link has expired.'; END IF;
  IF inv.max_uses > 0 AND inv.uses >= inv.max_uses THEN RAISE EXCEPTION 'This invite link has already been used.'; END IF;

  my_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF inv.allowed_emails IS NOT NULL AND array_length(inv.allowed_emails, 1) > 0
     AND NOT (my_email = ANY (inv.allowed_emails)) THEN
    RAISE EXCEPTION 'This invite is restricted to: %', array_to_string(inv.allowed_emails, ', ');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = inv.chat_id AND m.user_id = auth.uid()) THEN
    INSERT INTO public.chat_members (chat_id, user_id, role) VALUES (inv.chat_id, auth.uid(), 'member');
    UPDATE public.chat_invites SET uses = uses + 1 WHERE id = inv.id;
  END IF;

  RETURN inv.chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_chat_by_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_chat_by_invite(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
