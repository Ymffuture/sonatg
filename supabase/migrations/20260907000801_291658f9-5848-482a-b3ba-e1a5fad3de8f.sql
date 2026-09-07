ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_check
  CHECK (kind = ANY (ARRAY['text','image','voice','file','call','video','poll','system']));