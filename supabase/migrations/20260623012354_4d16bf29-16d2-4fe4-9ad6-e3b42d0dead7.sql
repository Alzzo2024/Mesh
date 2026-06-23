
-- 1) Fix reaction trigger cast (reaction_type -> notification_type via text)
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.posts WHERE id = NEW.post_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications(user_id, actor_id, type, post_id)
    VALUES(owner, NEW.user_id, NEW.reaction::text::public.notification_type, NEW.post_id);
  END IF;
  RETURN NEW;
END $$;

-- 2) Pinned posts (max 3 per user enforced by trigger)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
CREATE INDEX IF NOT EXISTS posts_pinned_idx ON public.posts(user_id, pinned_at) WHERE pinned_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_pinned_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pinned_at IS NOT NULL AND (OLD.pinned_at IS NULL OR OLD.pinned_at IS DISTINCT FROM NEW.pinned_at) THEN
    IF (SELECT count(*) FROM public.posts WHERE user_id = NEW.user_id AND pinned_at IS NOT NULL AND id <> NEW.id) >= 3 THEN
      RAISE EXCEPTION 'PIN_LIMIT_REACHED';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_pinned_limit ON public.posts;
CREATE TRIGGER trg_enforce_pinned_limit
BEFORE UPDATE OF pinned_at ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.enforce_pinned_limit();

-- 3) Add 'mention' to notification_type enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mention' AND enumtypid = 'public.notification_type'::regtype) THEN
    ALTER TYPE public.notification_type ADD VALUE 'mention';
  END IF;
END $$;
