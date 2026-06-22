
-- 1) Notifications table
CREATE TYPE public.notification_type AS ENUM ('comment', 'like', 'dislike', 'follow');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications select" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 2) Triggers to populate
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id, comment_id)
    VALUES(owner, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id)
    VALUES(owner, NEW.user_id, NEW.reaction::public.notification_type, NEW.post_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_reaction AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.follower_id <> NEW.following_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type)
    VALUES(NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- 3) last_read_at on conversation_members
ALTER TABLE public.conversation_members ADD COLUMN IF NOT EXISTS last_read_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversation_members SET last_read_at = now()
   WHERE conversation_id = _conv AND user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- 4) Profile gallery (extra screenshots)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gallery text[] NOT NULL DEFAULT '{}';

-- 5) Delete conversation (only by admin / either side of direct)
CREATE OR REPLACE FUNCTION public.delete_conversation(_conv uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); ok boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = me AND (
      is_admin = true OR
      (SELECT type FROM public.conversations WHERE id = _conv) = 'direct'
    )
  ) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.conversations WHERE id = _conv;
END $$;
REVOKE ALL ON FUNCTION public.delete_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_conversation(uuid) TO authenticated;

-- 6) Add member to group (admin only)
CREATE OR REPLACE FUNCTION public.add_group_member(_conv uuid, _user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conv AND user_id = me AND is_admin = true
  ) THEN RAISE EXCEPTION 'Not admin'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted' AND ((requester_id = me AND addressee_id = _user) OR (addressee_id = me AND requester_id = _user))
  ) THEN RAISE EXCEPTION 'Not friends with target'; END IF;
  INSERT INTO public.conversation_members(conversation_id, user_id, is_admin)
  VALUES(_conv, _user, false) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.add_group_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_group_member(uuid, uuid) TO authenticated;

-- 7) Delete own account
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM auth.users WHERE id = me;
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
