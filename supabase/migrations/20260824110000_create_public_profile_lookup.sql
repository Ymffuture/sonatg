-- Public, safe-to-expose profile lookup for the /u/:id share-contact deep
-- link. Uses a security definer function rather than a plain view so the
-- RLS bypass is explicit and unambiguous, rather than relying on view
-- ownership semantics. Only non-sensitive columns are returned — no email.

create or replace function public.get_public_profile(profile_id uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  bio text,
  is_pro boolean,
  is_ai boolean,
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
    p.facebook_url,
    p.x_url,
    p.instagram_url,
    p.threads_url
  from public.profiles p
  where p.id = profile_id;
$$;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;
