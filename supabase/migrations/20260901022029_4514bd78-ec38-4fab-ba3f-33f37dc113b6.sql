-- ============ 1. Column additions ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS threads_url text,
  ADD COLUMN IF NOT EXISTS theme_id text;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_broadcast boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_forwarded boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_check
  CHECK (kind = ANY (ARRAY['text','image','voice','file','call','video','poll']));

CREATE OR REPLACE VIEW public.visible_messages AS
  SELECT id, chat_id, sender_id, kind, body, media_url, duration_ms, created_at,
         is_encrypted, reply_to_id, edited_at, transcript, file_name, file_size,
         expires_at, scheduled_at, deleted_at, pinned_by, pinned_at, is_forwarded
  FROM public.messages m
  WHERE (expires_at IS NULL OR expires_at > now())
    AND (scheduled_at IS NULL OR scheduled_at <= now() OR sender_id = auth.uid());
GRANT SELECT ON public.visible_messages TO authenticated;

-- ============ 2. Classroom: classes ============
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  name text NOT NULL,
  join_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read classes" ON public.classes FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "creator inserts class" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "creator updates class" ON public.classes FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "creator deletes class" ON public.classes FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.generate_class_join_code()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      IF i = 4 THEN code := code || '-'; END IF;
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.join_code = code);
  END LOOP;
  RETURN code;
END; $$;

CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _chat uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT c.chat_id INTO _chat FROM public.classes c
    WHERE upper(c.join_code) = upper(_code) AND c.is_active;
  IF _chat IS NULL THEN RAISE EXCEPTION 'Invalid or inactive class code'; END IF;
  INSERT INTO public.chat_members (chat_id, user_id, role)
    VALUES (_chat, auth.uid(), 'member')
    ON CONFLICT (chat_id, user_id) DO NOTHING;
  RETURN _chat;
END; $$;

-- ============ 3. Polls ============
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  question text NOT NULL,
  is_quiz boolean NOT NULL DEFAULT false,
  correct_option_index int,
  allow_multiple boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  results_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  position int NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (option_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls, public.poll_options, public.poll_votes TO authenticated;
GRANT ALL ON public.polls, public.poll_options, public.poll_votes TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read polls" ON public.polls FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "members create polls" ON public.polls FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "creator updates polls" ON public.polls FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "creator deletes polls" ON public.polls FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "members read poll options" ON public.poll_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND public.is_chat_member(p.chat_id, auth.uid())));
CREATE POLICY "creator writes poll options" ON public.poll_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.created_by = auth.uid()));
CREATE POLICY "creator updates poll options" ON public.poll_options FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.created_by = auth.uid()));
CREATE POLICY "creator deletes poll options" ON public.poll_options FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.created_by = auth.uid()));

CREATE POLICY "members read votes" ON public.poll_votes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND public.is_chat_member(p.chat_id, auth.uid())));
CREATE POLICY "self votes" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND public.is_chat_member(p.chat_id, auth.uid())));
CREATE POLICY "self retracts votes" ON public.poll_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============ 4. Bookmarks & chat clears ============
CREATE TABLE IF NOT EXISTS public.message_bookmarks (
  user_id uuid NOT NULL,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_bookmarks TO authenticated;
GRANT ALL ON public.message_bookmarks TO service_role;
ALTER TABLE public.message_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bookmarks" ON public.message_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.chat_clears (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cleared_before timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_clears TO authenticated;
GRANT ALL ON public.chat_clears TO service_role;
ALTER TABLE public.chat_clears ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat clears" ON public.chat_clears FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ 5. Moderation flags + queue view ============
CREATE TABLE IF NOT EXISTS public.moderation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid,
  sender_id uuid NOT NULL,
  message_id uuid,
  body_snapshot text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','medium','high')),
  score numeric NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  categories text[] NOT NULL DEFAULT '{}',
  pattern_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.moderation_flags TO authenticated;
GRANT ALL ON public.moderation_flags TO service_role;
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self logs flag" ON public.moderation_flags FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "admins read flags" ON public.moderation_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "admins update flags" ON public.moderation_flags FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE OR REPLACE VIEW public.moderation_queue
WITH (security_invoker = on) AS
  SELECT f.id, f.chat_id, f.sender_id, p.display_name AS sender_display_name,
         f.body_snapshot, f.severity, f.score, f.blocked, f.categories,
         f.pattern_signals, f.reviewed, f.created_at
  FROM public.moderation_flags f
  LEFT JOIN public.profiles p ON p.id = f.sender_id;
GRANT SELECT ON public.moderation_queue TO authenticated;

-- ============ 6. Announcements & notification prefs ============
CREATE TABLE IF NOT EXISTS public.app_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  notify_subscribers boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_announcements TO authenticated;
GRANT SELECT ON public.app_announcements TO anon;
GRANT ALL ON public.app_announcements TO service_role;
ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads announcements" ON public.app_announcements FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write announcements" ON public.app_announcements FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update announcements" ON public.app_announcements FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete announcements" ON public.app_announcements FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  notify_app_updates boolean NOT NULL DEFAULT true,
  notify_offline_messages boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notification prefs" ON public.notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ 7. Org settings ============
CREATE TABLE IF NOT EXISTS public.org_settings (
  id text PRIMARY KEY,
  max_doc_bytes bigint NOT NULL DEFAULT 20971520,
  max_image_bytes bigint NOT NULL DEFAULT 10485760,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_settings TO authenticated;
GRANT ALL ON public.org_settings TO service_role;
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads org settings" ON public.org_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins update org settings" ON public.org_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.org_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ============ 8. Blog posts ============
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  cover_image_url text,
  tag text NOT NULL DEFAULT 'general',
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  author_id uuid,
  read_mins int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT SELECT ON public.blog_posts TO anon;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published posts are public" ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert posts" ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update posts" ON public.blog_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete posts" ON public.blog_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ 9. Broadcast posters ============
CREATE TABLE IF NOT EXISTS public.broadcast_posters (
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_posters TO authenticated;
GRANT ALL ON public.broadcast_posters TO service_role;
ALTER TABLE public.broadcast_posters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read posters" ON public.broadcast_posters FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "chat admins manage posters" ON public.broadcast_posters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.chat_id = broadcast_posters.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.chat_id = broadcast_posters.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

-- ============ 10. Helper functions ============
CREATE OR REPLACE FUNCTION public.can_post_in_chat(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_chat_member(_chat_id, _user_id)
     AND (
       NOT COALESCE((SELECT c.is_broadcast FROM public.chats c WHERE c.id = _chat_id), false)
       OR EXISTS (SELECT 1 FROM public.broadcast_posters bp WHERE bp.chat_id = _chat_id AND bp.user_id = _user_id)
       OR EXISTS (SELECT 1 FROM public.chat_members cm WHERE cm.chat_id = _chat_id AND cm.user_id = _user_id AND cm.role = 'admin')
     );
$$;

CREATE OR REPLACE FUNCTION public.is_user_offline(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT p.last_seen < now() - interval '3 minutes' FROM public.profiles p WHERE p.id = _user_id), true);
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE (
  id uuid, display_name text, avatar_url text, bio text,
  is_pro boolean, is_ai boolean,
  facebook_url text, x_url text, instagram_url text, threads_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url, p.bio, p.is_pro, p.is_ai,
         p.facebook_url, p.x_url, p.instagram_url, p.threads_url
  FROM public.profiles p WHERE p.id = profile_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;

-- ============ 11. Admin dashboard stats ============
CREATE OR REPLACE FUNCTION public.compute_dashboard_stats()
RETURNS TABLE (
  total_members bigint, active_users_24h bigint, active_users_7d bigint,
  messages_24h bigint, messages_7d bigint,
  unreviewed_flags bigint, unreviewed_high_severity_flags bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.profiles WHERE last_seen > now() - interval '24 hours'),
    (SELECT count(*) FROM public.profiles WHERE last_seen > now() - interval '7 days'),
    (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '24 hours'),
    (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '7 days'),
    (SELECT count(*) FROM public.moderation_flags WHERE NOT reviewed),
    (SELECT count(*) FROM public.moderation_flags WHERE NOT reviewed AND severity = 'high');
$$;

CREATE OR REPLACE VIEW public.admin_dashboard_stats AS
  SELECT s.* FROM public.compute_dashboard_stats() s
  WHERE public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator');
GRANT SELECT ON public.admin_dashboard_stats TO authenticated;