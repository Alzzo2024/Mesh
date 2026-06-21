
-- 1) Hide profiles.birth_date from non-owners via column-level privilege.
REVOKE SELECT (birth_date) ON public.profiles FROM authenticated, anon;
-- Owner can fetch their own birth_date via this helper.
CREATE OR REPLACE FUNCTION public.get_my_birth_date()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT birth_date FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_birth_date() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_birth_date() TO authenticated;

-- 2) Helper: can the current user view content from _target?
CREATE OR REPLACE FUNCTION public.can_view_user_content(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _target = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _target AND NOT p.is_private
    )
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.following_id = _target
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_user_content(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_user_content(uuid) TO authenticated;

-- Rewrite SELECT policies on posts/comments/post_reactions to honour is_private.
DROP POLICY IF EXISTS "Posts viewable by authenticated" ON public.posts;
CREATE POLICY "Posts visible if public or followed"
  ON public.posts FOR SELECT TO authenticated
  USING (public.can_view_user_content(user_id));

DROP POLICY IF EXISTS "Comments readable by authenticated" ON public.comments;
CREATE POLICY "Comments visible if author content visible"
  ON public.comments FOR SELECT TO authenticated
  USING (public.can_view_user_content(user_id));

DROP POLICY IF EXISTS "Reactions readable by authenticated" ON public.post_reactions;
CREATE POLICY "Reactions visible if author content visible"
  ON public.post_reactions FOR SELECT TO authenticated
  USING (public.can_view_user_content(user_id));

-- 3) Lock down conversation_members INSERT: cannot self-promote to admin,
-- and self-joining requires being the conversation creator (or already admin).
DROP POLICY IF EXISTS "Insert membership if creator or admin" ON public.conversation_members;
CREATE POLICY "Insert membership controlled"
  ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_members.conversation_id AND c.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversation_members.conversation_id
          AND cm.user_id = auth.uid() AND cm.is_admin
      )
    )
    AND (
      is_admin = false
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_members.conversation_id AND c.created_by = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = conversation_members.conversation_id
          AND cm.user_id = auth.uid() AND cm.is_admin
      )
    )
  );

-- 4) Friendship-gated conversation RPCs.
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(_other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF me = _other_user THEN RAISE EXCEPTION 'Cannot chat with yourself'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = me AND addressee_id = _other_user)
        OR (addressee_id = me AND requester_id = _other_user))
  ) THEN
    RAISE EXCEPTION 'Not friends with target user';
  END IF;

  SELECT c.id INTO conv_id
  FROM public.conversations c
  JOIN public.conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = me
  JOIN public.conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = _other_user
  WHERE c.type = 'direct'
  LIMIT 1;

  IF conv_id IS NOT NULL THEN RETURN conv_id; END IF;

  INSERT INTO public.conversations (type, created_by) VALUES ('direct', me) RETURNING id INTO conv_id;
  INSERT INTO public.conversation_members (conversation_id, user_id, is_admin) VALUES (conv_id, me, true);
  INSERT INTO public.conversation_members (conversation_id, user_id, is_admin) VALUES (conv_id, _other_user, false);
  RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_conversation(_name text, _member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
  me uuid := auth.uid();
  uid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Group name required'; END IF;

  IF _member_ids IS NOT NULL THEN
    FOREACH uid IN ARRAY _member_ids LOOP
      IF uid <> me AND NOT EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND ((requester_id = me AND addressee_id = uid)
            OR (addressee_id = me AND requester_id = uid))
      ) THEN
        RAISE EXCEPTION 'Not friends with user %', uid;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.conversations (type, name, created_by)
  VALUES ('group', trim(_name), me)
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_members (conversation_id, user_id, is_admin)
  VALUES (conv_id, me, true);

  IF _member_ids IS NOT NULL THEN
    FOREACH uid IN ARRAY _member_ids LOOP
      IF uid <> me THEN
        INSERT INTO public.conversation_members (conversation_id, user_id, is_admin)
        VALUES (conv_id, uid, false)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN conv_id;
END;
$$;

-- 5) Trust votes — voter can update/delete own.
CREATE POLICY "Voters update own trust votes"
  ON public.trust_votes FOR UPDATE TO authenticated
  USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Voters delete own trust votes"
  ON public.trust_votes FOR DELETE TO authenticated
  USING (auth.uid() = voter_id);

-- 6) message-media bucket — explicit UPDATE policy scoped to owner folder.
CREATE POLICY "Users update own message media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'message-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'message-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 7) Realtime topics — disallow non-chat topics entirely.
DROP POLICY IF EXISTS "Authenticated can use realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can publish to allowed topics" ON realtime.messages;
CREATE POLICY "Authenticated can use chat topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'chat:%'
    AND public.is_conversation_member(
      (NULLIF(SUBSTRING(realtime.topic() FROM 6), ''))::uuid,
      auth.uid()
    )
  );
CREATE POLICY "Authenticated can publish to chat topics"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'chat:%'
    AND public.is_conversation_member(
      (NULLIF(SUBSTRING(realtime.topic() FROM 6), ''))::uuid,
      auth.uid()
    )
  );

-- 8) Lock down SECURITY DEFINER function EXECUTE privileges.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_fixed_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) TO authenticated;
