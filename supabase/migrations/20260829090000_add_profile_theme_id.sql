-- Persists the user's chosen chat theme (see src/lib/theme-presets.ts) on
-- their profile instead of only in localStorage, so it follows them
-- across devices/browsers.
alter table public.profiles add column if not exists theme_id text;
