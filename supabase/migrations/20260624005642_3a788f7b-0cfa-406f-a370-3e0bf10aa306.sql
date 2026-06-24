
-- Profiles: link + fixed_id change tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS last_fixed_id_update timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_link_check
  CHECK (link IS NULL OR (length(link) <= 200 AND link ~* '^https?://'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_fixed_id_format
  CHECK (fixed_id ~ '^[A-Za-z0-9]{1,10}$');

-- Trigger to validate fixed_id changes (14 days)
CREATE OR REPLACE FUNCTION public.enforce_fixed_id_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.fixed_id IS DISTINCT FROM OLD.fixed_id THEN
    IF OLD.last_fixed_id_update IS NOT NULL
       AND OLD.last_fixed_id_update > now() - interval '14 days' THEN
      RAISE EXCEPTION 'FIXED_ID_LOCKED';
    END IF;
    NEW.last_fixed_id_update := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_fixed_id ON public.profiles;
CREATE TRIGGER trg_enforce_fixed_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_fixed_id_rules();

-- Conversation pin
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

-- Reposts table
CREATE TABLE IF NOT EXISTS public.post_reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

GRANT SELECT, INSERT, DELETE ON public.post_reposts TO authenticated;
GRANT ALL ON public.post_reposts TO service_role;

ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone authed can read reposts" ON public.post_reposts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own reposts" ON public.post_reposts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users delete own reposts" ON public.post_reposts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_post_reposts_user ON public.post_reposts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reposts_post ON public.post_reposts(post_id);

-- Repost notification trigger
CREATE OR REPLACE FUNCTION public.notify_on_repost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id)
    VALUES(owner, NEW.user_id, 'repost', NEW.post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_on_repost ON public.post_reposts;
CREATE TRIGGER trg_notify_on_repost
  AFTER INSERT ON public.post_reposts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_repost();

-- Deduplicate notifications: delete duplicates, then unique index
DELETE FROM public.notifications a USING public.notifications b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.actor_id IS NOT DISTINCT FROM b.actor_id
  AND a.type = b.type
  AND a.post_id IS NOT DISTINCT FROM b.post_id
  AND COALESCE(a.comment_id::text, '') = COALESCE(b.comment_id::text, '');

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe
  ON public.notifications (
    user_id,
    type,
    COALESCE(actor_id::text, ''),
    COALESCE(post_id::text, ''),
    COALESCE(comment_id::text, '')
  );

-- Update reaction trigger: dedupe via ON CONFLICT and remove previous opposite reaction notif
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    -- remove opposite reaction notification (like vs dislike) if exists
    DELETE FROM public.notifications
      WHERE user_id = owner AND actor_id = NEW.user_id AND post_id = NEW.post_id
        AND type IN ('like','dislike') AND type::text <> NEW.reaction::text;
    INSERT INTO public.notifications(user_id, actor_id, type, post_id)
    VALUES(owner, NEW.user_id, NEW.reaction::text::public.notification_type, NEW.post_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- When reaction is removed, also remove the matching notification
CREATE OR REPLACE FUNCTION public.cleanup_reaction_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = OLD.post_id;
  IF owner IS NOT NULL THEN
    DELETE FROM public.notifications
      WHERE user_id = owner AND actor_id = OLD.user_id AND post_id = OLD.post_id
        AND type::text = OLD.reaction::text;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_cleanup_reaction_notif ON public.post_reactions;
CREATE TRIGGER trg_cleanup_reaction_notif
  AFTER DELETE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_reaction_notification();

-- Same for reposts
CREATE OR REPLACE FUNCTION public.cleanup_repost_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = OLD.post_id;
  IF owner IS NOT NULL THEN
    DELETE FROM public.notifications
      WHERE user_id = owner AND actor_id = OLD.user_id AND post_id = OLD.post_id
        AND type = 'repost';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_cleanup_repost_notif ON public.post_reposts;
CREATE TRIGGER trg_cleanup_repost_notif
  AFTER DELETE ON public.post_reposts
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_repost_notification();
