-- Messages are currently hard-deleted, which means other participants
-- never see a "This message was deleted" placeholder — the row is just
-- gone. Switch to soft-delete: keep the row, clear its content, and mark
-- when it was deleted so the UI can render a placeholder instead.

alter table public.messages
  add column if not exists deleted_at timestamptz;
