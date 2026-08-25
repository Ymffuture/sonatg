-- Blog: posts table, RLS (public read of published posts, admin-only write),
-- and a public storage bucket for cover / inline images.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  cover_image_url text,
  tag text not null default 'General',
  body text not null default '',        -- markdown/plaintext with blank-line paragraphs
  published boolean not null default true,
  author_id uuid references auth.users(id) on delete set null,
  read_mins int not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_published_created_idx
  on public.blog_posts (published, created_at desc);

alter table public.blog_posts enable row level security;

drop policy if exists "blog_posts_public_read" on public.blog_posts;
create policy "blog_posts_public_read"
  on public.blog_posts for select
  using (published = true);

drop policy if exists "blog_posts_admin_read_all" on public.blog_posts;
create policy "blog_posts_admin_read_all"
  on public.blog_posts for select
  using (exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
  ));

drop policy if exists "blog_posts_admin_write" on public.blog_posts;
create policy "blog_posts_admin_write"
  on public.blog_posts for insert
  with check (exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
  ));

drop policy if exists "blog_posts_admin_update" on public.blog_posts;
create policy "blog_posts_admin_update"
  on public.blog_posts for update
  using (exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
  ));

drop policy if exists "blog_posts_admin_delete" on public.blog_posts;
create policy "blog_posts_admin_delete"
  on public.blog_posts for delete
  using (exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
  ));

create or replace function public.blog_posts_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch_updated_at on public.blog_posts;
create trigger blog_posts_touch_updated_at
  before update on public.blog_posts
  for each row execute function public.blog_posts_set_updated_at();

insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do nothing;

drop policy if exists "blog_media_public_read" on storage.objects;
create policy "blog_media_public_read"
  on storage.objects for select
  using (bucket_id = 'blog-media');

drop policy if exists "blog_media_admin_write" on storage.objects;
create policy "blog_media_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'blog-media'
    and exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );

drop policy if exists "blog_media_admin_update" on storage.objects;
create policy "blog_media_admin_update"
  on storage.objects for update
  using (
    bucket_id = 'blog-media'
    and exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );

drop policy if exists "blog_media_admin_delete" on storage.objects;
create policy "blog_media_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'blog-media'
    and exists (
      select 1 from public.user_roles
      where user_roles.user_id = auth.uid() and user_roles.role = 'admin'
    )
  );

insert into public.blog_posts (slug, title, description, tag, read_mins, body, published)
values
(
  'end-to-end-privacy-in-everyday-chat',
  'What ''Private'' Should Actually Mean in a Chat App',
  'Most apps say ''your data is safe'' without explaining what that means. Here''s a plain-language look at what Sona actually does — and doesn''t do — with your messages.',
  'Privacy', 6,
  E'Every messaging app claims to care about privacy. Almost none explain what that promise actually covers. When you send a message, who can read it — right now, and five years from now? That question is more useful than any marketing slogan, so let''s answer it directly for how Sona is built.\n\nBy default, messages in Sona are stored so that only members of a chat can read them, enforced at the database level with row-level security rather than trusted to application code alone. That distinction matters: a bug in a screen''s logic shouldn''t be able to leak a stranger''s conversation, because the database itself refuses the request before it ever reaches your screen.\n\nFor people who want a stronger guarantee, Sona Pro adds the option to hide and encrypt a conversation. When you turn this on, new messages in that chat are encrypted on your own device using AES-GCM before they ever leave it. The server stores ciphertext it cannot read.\n\nIt''s worth being honest about what this does and doesn''t protect against. Client-side encryption protects your messages from a compromised or curious server operator, and from anyone intercepting traffic in transit. It does not protect you if someone has physical access to your unlocked device, or if the person you''re chatting with chooses to screenshot or forward what you sent them.\n\nThe practical takeaway: use hidden, encrypted chats for the conversations where confidentiality genuinely matters to you. For everyday chatting with friends, the default row-level security is already doing real work you don''t have to think about.',
  true
),
(
  'why-your-group-chat-feels-chaotic',
  'Why Your Group Chat Feels Chaotic (and How to Fix It Without Leaving It)',
  'Group chats don''t get chaotic because of the people in them — they get chaotic because most chat apps give you no tools to organize a fast-moving conversation.',
  'Guides', 5,
  E'There''s a specific feeling everyone who''s been in an active group chat knows: you open the app, see 40 unread messages, and have no idea which three actually matter to you. This isn''t a discipline problem — it''s a tooling problem.\n\nThe single most useful fix is threaded replies. Instead of a message getting buried the moment three other people start talking about something else, replying to a specific message keeps that sub-conversation visibly attached to what it''s responding to.\n\nPinning is the second underused tool. Every active group chat eventually needs a message everyone should be able to find without scrolling — an address, a deadline, a link.\n\nReactions do more organizational work than people give them credit for. A thumbs-up on ''can everyone confirm 6pm'' is faster and less noisy than fourteen separate ''yes'' messages.\n\nScheduled messages solve a different, quieter problem: the 11pm thought you have about tomorrow''s plan that you don''t want to send at 11pm.\n\nNone of this requires switching apps or imposing new rules on your group. Chaos in a group chat is almost always a missing feature, not a people problem.',
  true
),
(
  'ai-inside-your-messages-without-losing-context',
  'The Right Way to Put AI Inside a Chat App',
  'Bolting a chatbot onto a messaging app is easy. Making it useful without breaking the flow of a real conversation is the actual hard part.',
  'Product', 7,
  E'The easy version of ''AI in a chat app'' is a separate tab with a chatbot in it, disconnected from everything else happening in your conversations.\n\nThe harder, more useful version is AI that can be summoned inside the conversation you''re already having. That''s the reasoning behind how @sona mentions work.\n\nThere''s a real design tension worth naming honestly: an AI that can read your conversation is more useful, but it''s also a bigger trust ask. That''s why Sona AI only participates when explicitly mentioned or in its own dedicated chat.\n\nImage understanding follows the same logic. Being able to attach a photo and ask a question about it is only useful if it happens inside the flow of the conversation you''re already having.\n\nThe last piece is restraint. Every additional AI feature is a candidate for making the app feel cluttered. The features that earned a place in Sona were each kept because they solved a real friction point.',
  true
)
on conflict (slug) do nothing;
