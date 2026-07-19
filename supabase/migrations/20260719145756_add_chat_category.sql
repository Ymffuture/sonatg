-- Add a category to group chats (education, business, support, etc.)
-- Nullable + only meaningful for is_group = true; regular 1:1 chats and the
-- Sona AI chat just leave this null.
alter table public.chats
  add column category text
  check (category is null or category in ('general', 'education', 'business', 'support', 'social', 'other'));

comment on column public.chats.category is
  'Optional category label for group chats: general, education, business, support, social, other';
