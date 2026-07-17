
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Allow sender to update their own message (body/edited_at)
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- People directory: authenticated users can browse profiles to start chats.
-- (Assumes an existing profiles SELECT policy may be restrictive; add a broad one.)
DROP POLICY IF EXISTS "profiles_browse_authenticated" ON public.profiles;
CREATE POLICY "profiles_browse_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);
