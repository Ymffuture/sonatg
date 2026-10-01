create or replace view public.visible_messages with (security_invoker = on) as
select id, chat_id, sender_id, kind, body, media_url, duration_ms, created_at, is_encrypted, reply_to_id, edited_at, transcript, file_name, file_size, expires_at, scheduled_at, deleted_at, pinned_by, pinned_at, is_forwarded, ad_title, ad_cta_label, ad_cta_url
from public.messages m
where (expires_at is null or expires_at > now()) and (scheduled_at is null or scheduled_at <= now() or sender_id = auth.uid());
grant select on public.visible_messages to authenticated;