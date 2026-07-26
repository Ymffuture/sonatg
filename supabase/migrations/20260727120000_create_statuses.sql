-- The Status feature (src/components/Status.tsx) reads/writes public.statuses
-- and public.status_views, and uploads media to a 'statuses' storage bucket,
-- but none of these were ever created by a migration. That's why text
-- statuses may look like they "work" (if these objects already exist by
-- hand in your project) while image/video uploads fail outright with
-- "relation does not exist" / "Bucket not found" on a fresh project.

-- Statuses table
create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('text', 'image', 'video')),
  body text,
  media_url text,
  media_path text,
  media_provider text not null default 'supabase' check (media_provider in ('supabase', 'cloudinary')),
  media_public_id text,
  duration_ms integer,
  background_color text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
grant select, insert, delete on public.statuses to authenticated;
grant all on public.statuses to service_role;
alter table public.statuses enable row level security;

create policy "statuses readable by authenticated" on public.statuses
  for select to authenticated using (expires_at > now());
create policy "statuses insert by self" on public.statuses
  for insert to authenticated with check (auth.uid() = user_id);
create policy "statuses delete by self" on public.statuses
  for delete to authenticated using (auth.uid() = user_id);

-- Status views (who has seen which status)
create table public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);
grant select, insert on public.status_views to authenticated;
grant all on public.status_views to service_role;
alter table public.status_views enable row level security;

create policy "status views readable by authenticated" on public.status_views
  for select to authenticated using (true);
create policy "status views insert by self" on public.status_views
  for insert to authenticated with check (auth.uid() = viewer_id);

-- Storage bucket for image/video statuses uploaded via Supabase Storage
-- (the Cloudinary path in cloudinary.ts is only used when
-- VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET are set).
insert into storage.buckets (id, name, public)
values ('statuses', 'statuses', false)
on conflict (id) do nothing;

create policy "status media upload by owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'statuses' and (split_part(name, '/', 1))::uuid = auth.uid());
create policy "status media read for authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'statuses');
create policy "status media delete by owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'statuses' and (split_part(name, '/', 1))::uuid = auth.uid());

-- Realtime (StatusBar subscribes to postgres_changes on both tables)
alter publication supabase_realtime add table public.statuses;
alter publication supabase_realtime add table public.status_views;
