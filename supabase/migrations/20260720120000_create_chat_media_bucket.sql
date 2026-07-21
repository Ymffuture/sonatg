-- The earlier migration (20260714114656...) created RLS policies for a
-- 'chat-media' storage bucket, but never created the bucket itself — it
-- must have existed already on the original project (created outside the
-- SQL migrations, e.g. via Lovable's own tooling or the dashboard UI by
-- hand). On a fresh Supabase project, uploads fail with "Bucket not found"
-- until this row actually exists.
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;
