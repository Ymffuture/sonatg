-- Business accounts (self-serve, paid, auto-approved via PayPal capture —
-- see src/lib/paypal.functions.ts) get their own verified badge, distinct
-- from the existing is_ai / is_pro badge, and can send a new "ad" message
-- kind: an image + title + call-to-action button rendered as a card in
-- normal chats (see MessageBubble.tsx's AdCard renderer).

alter table public.profiles
  add column if not exists is_business boolean not null default false;

comment on column public.profiles.is_business is
  'Self-serve verified business account (paid via PayPal, see capturePaypalBusinessOrder). Grants the business verified badge and the ability to send "ad" messages.';

-- messages.kind already accepts arbitrary text (no CHECK constraint in
-- this schema — see the existing "poll" / "system" kinds), so no enum
-- change needed. Add the ad-specific columns, all nullable since they only
-- apply to kind = 'ad' rows.
alter table public.messages
  add column if not exists ad_title text,
  add column if not exists ad_cta_label text,
  add column if not exists ad_cta_url text;

comment on column public.messages.ad_title is 'Ad card headline. Only set when kind = ''ad''.';
comment on column public.messages.ad_cta_label is 'Ad card button label, e.g. "Shop now". Only set when kind = ''ad''.';
comment on column public.messages.ad_cta_url is 'Ad card button destination URL. Only set when kind = ''ad''.';

-- The public profile lookup (used by the /u/:id share-contact link) only
-- returns an explicit column list, so is_business needs to be added there
-- too or shared profile links would never show the business badge.
create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  is_pro boolean,
  is_ai boolean,
  is_business boolean,
  facebook_url text,
  x_url text,
  instagram_url text,
  threads_url text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.is_pro,
    p.is_ai,
    p.is_business,
    p.facebook_url,
    p.x_url,
    p.instagram_url,
    p.threads_url
  from public.profiles p
  where p.id = profile_id;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- Guard rail: only a verified business account may insert an 'ad' message.
-- The existing "messages insert by member self" policy is PERMISSIVE, so a
-- second permissive policy here would only ever OR in more access, not
-- restrict it. This has to be a RESTRICTIVE policy (AND'd with the existing
-- one) so non-business senders are actually blocked from kind = 'ad'.
drop policy if exists "business accounts can send ad messages" on public.messages;
create policy "business accounts can send ad messages"
  on public.messages
  as restrictive
  for insert
  with check (
    kind <> 'ad'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_business = true
    )
  );
