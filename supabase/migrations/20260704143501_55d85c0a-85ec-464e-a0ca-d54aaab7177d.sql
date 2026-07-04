DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comments'
      AND policyname = 'Users update own comments'
  ) THEN
    CREATE POLICY "Users update own comments"
      ON public.comments
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "Users create own weekly trust votes" ON public.trust_votes;
CREATE POLICY "Users create own weekly trust votes"
  ON public.trust_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = voter_id
    AND voter_id <> target_user_id
    AND vote_week = date_trunc('week', now())::date
  );

DROP POLICY IF EXISTS "Voters update own trust votes" ON public.trust_votes;
CREATE POLICY "Voters update own trust votes"
  ON public.trust_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = voter_id)
  WITH CHECK (
    auth.uid() = voter_id
    AND voter_id <> target_user_id
    AND vote_week = date_trunc('week', now())::date
  );