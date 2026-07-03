
-- 1) Drop duplicate triggers (root cause of follow/comment/like failures)
DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.comments;
DROP TRIGGER IF EXISTS trg_notify_on_follow ON public.follows;
DROP TRIGGER IF EXISTS trg_notify_on_reaction ON public.post_reactions;

-- 2) Harden notify functions with ON CONFLICT DO NOTHING to survive future dupes
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id, comment_id)
    VALUES(owner, NEW.user_id, 'comment', NEW.post_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.follower_id <> NEW.following_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type)
    VALUES(NEW.following_id, NEW.follower_id, 'follow')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 3) Bookmarks (saved posts)
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_bookmarks TO authenticated;
GRANT ALL ON public.post_bookmarks TO service_role;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bookmarks" ON public.post_bookmarks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) Pinned conversations per user (max 3 enforced via trigger)
CREATE TABLE IF NOT EXISTS public.conversation_pins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
GRANT SELECT, INSERT, DELETE ON public.conversation_pins TO authenticated;
GRANT ALL ON public.conversation_pins TO service_role;
ALTER TABLE public.conversation_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conv pins" ON public.conversation_pins
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_conv_pin_limit()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT count(*) FROM public.conversation_pins WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'CONV_PIN_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_conv_pin_limit ON public.conversation_pins;
CREATE TRIGGER trg_enforce_conv_pin_limit BEFORE INSERT ON public.conversation_pins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_conv_pin_limit();

-- 5) Conversation avatar + rename support (columns + admin RPCs)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.update_conversation_meta(_conv uuid, _name text, _avatar text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = me AND is_admin = true
  ) THEN RAISE EXCEPTION 'Not admin'; END IF;
  UPDATE public.conversations
    SET name = COALESCE(_name, name),
        avatar_url = COALESCE(_avatar, avatar_url)
    WHERE id = _conv;
END $$;
