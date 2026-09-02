CREATE TABLE public.chat_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  allowed_email text,
  created_by uuid NOT NULL,
  expires_at timestamptz,
  max_uses integer NOT NULL DEFAULT 0,
  uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_invites_chat_id_idx ON public.chat_invites(chat_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_invites TO authenticated;
GRANT ALL ON public.chat_invites TO service_role;

ALTER TABLE public.chat_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chat invites"
  ON public.chat_invites FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Members can create chat invites"
  ON public.chat_invites FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY "Creators can update their chat invites"
  ON public.chat_invites FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators can delete their chat invites"
  ON public.chat_invites FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.generate_chat_invite_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := encode(gen_random_bytes(12), 'hex');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.chat_invites WHERE token = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_chat_invite_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_chat_invite_token() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.preview_chat_invite(_token text)
RETURNS TABLE(chat_id uuid, title text, avatar_url text, is_group boolean, allowed_email text, is_valid boolean, reason text, already_member boolean)
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
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, NULL::boolean, NULL::text, false, 'This invite link is not valid.'::text, false;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.chats WHERE id = inv.chat_id;
  my_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  IF NOT inv.is_active THEN ok := false; why := 'This invite link has been revoked.';
  ELSIF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN ok := false; why := 'This invite link has expired.';
  ELSIF inv.max_uses > 0 AND inv.uses >= inv.max_uses THEN ok := false; why := 'This invite link has already been used.';
  ELSIF inv.allowed_email IS NOT NULL AND lower(inv.allowed_email) <> my_email THEN
    ok := false; why := 'This invite is restricted to ' || inv.allowed_email || '.';
  END IF;

  RETURN QUERY SELECT c.id, c.title, c.avatar_url, c.is_group, inv.allowed_email, ok, why,
    EXISTS (SELECT 1 FROM public.chat_members m WHERE m.chat_id = c.id AND m.user_id = auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.preview_chat_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_chat_invite(text) TO authenticated, service_role;

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
  IF inv.allowed_email IS NOT NULL AND lower(inv.allowed_email) <> my_email THEN
    RAISE EXCEPTION 'This invite is restricted to %', inv.allowed_email;
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