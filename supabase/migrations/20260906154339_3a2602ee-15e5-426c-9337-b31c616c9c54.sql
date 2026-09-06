CREATE TABLE IF NOT EXISTS public.status_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_reactions TO authenticated;
GRANT ALL ON public.status_reactions TO service_role;

ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own status reactions"
ON public.status_reactions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Status owner can see reactions"
ON public.status_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.statuses s WHERE s.id = status_id AND s.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS status_reactions_status_idx ON public.status_reactions(status_id);