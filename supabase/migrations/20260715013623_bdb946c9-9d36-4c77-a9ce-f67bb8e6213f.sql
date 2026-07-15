
CREATE TABLE public.message_reads (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read receipts in their chats"
  ON public.message_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reads.message_id
        AND public.is_chat_member(m.chat_id, auth.uid())
    )
  );

CREATE POLICY "users mark own reads for chats they belong to"
  ON public.message_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reads.message_id
        AND public.is_chat_member(m.chat_id, auth.uid())
    )
  );

CREATE POLICY "users delete own reads"
  ON public.message_reads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX message_reads_user_idx ON public.message_reads (user_id, message_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
