CREATE TABLE public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  reported_id uuid not null,
  chat_id uuid,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports insert self" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports read own or admin" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reports update by admin" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "blocks visible to blocked user" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocked_id);