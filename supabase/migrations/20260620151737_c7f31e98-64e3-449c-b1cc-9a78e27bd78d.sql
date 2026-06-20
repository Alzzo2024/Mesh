ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users update own posts" ON public.posts;
CREATE POLICY "Users update own posts"
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_at timestamp with time zone;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.trust_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  vote_week date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT trust_votes_no_self CHECK (voter_id <> target_user_id),
  CONSTRAINT trust_votes_one_per_week UNIQUE (voter_id, vote_week)
);

GRANT SELECT, INSERT ON public.trust_votes TO authenticated;
GRANT ALL ON public.trust_votes TO service_role;

ALTER TABLE public.trust_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trust votes readable by authenticated" ON public.trust_votes;
CREATE POLICY "Trust votes readable by authenticated"
ON public.trust_votes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users create own weekly trust votes" ON public.trust_votes;
CREATE POLICY "Users create own weekly trust votes"
ON public.trust_votes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = voter_id AND voter_id <> target_user_id);

CREATE INDEX IF NOT EXISTS trust_votes_target_idx ON public.trust_votes(target_user_id);
CREATE INDEX IF NOT EXISTS trust_votes_voter_week_idx ON public.trust_votes(voter_id, vote_week);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (char_length(emoji) <= 16),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_unique_user UNIQUE (message_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read message reactions" ON public.message_reactions;
CREATE POLICY "Members read message reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = message_reactions.message_id
      AND public.is_conversation_member(m.conversation_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Members add own message reactions" ON public.message_reactions;
CREATE POLICY "Members add own message reactions"
ON public.message_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.id = message_reactions.message_id
      AND public.is_conversation_member(m.conversation_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users update own message reactions" ON public.message_reactions;
CREATE POLICY "Users update own message reactions"
ON public.message_reactions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own message reactions" ON public.message_reactions;
CREATE POLICY "Users delete own message reactions"
ON public.message_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert membership if member or self-direct" ON public.conversation_members;
CREATE POLICY "Insert membership if creator or admin"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_members.conversation_id
      AND c.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.is_admin
  )
);

DROP POLICY IF EXISTS "Admins update membership" ON public.conversation_members;
CREATE POLICY "Admins update membership"
ON public.conversation_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.is_admin
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
      AND cm.is_admin
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.trust_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;