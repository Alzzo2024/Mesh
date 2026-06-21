
-- 1) Profiles: restrict SELECT to authenticated
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2) Friendships: only addressee can accept/update
DROP POLICY IF EXISTS "Addressee can update (accept)" ON public.friendships;
CREATE POLICY "Addressee can accept friendship"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- 3) Trust votes: restrict reads to participants
DROP POLICY IF EXISTS "Trust votes readable by authenticated" ON public.trust_votes;
CREATE POLICY "Trust votes visible to participants"
  ON public.trust_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = voter_id OR auth.uid() = target_user_id);

-- 4) Message-media storage: only conversation members can read
DROP POLICY IF EXISTS "Message media readable by authenticated" ON storage.objects;
CREATE POLICY "Message media readable by conversation members"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-media'
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.media_url = 'message-media/' || storage.objects.name
        AND public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

-- 5) Realtime broadcast/presence: restrict topic access
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime topics" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime topics"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    -- Chat topics are scoped per conversation id
    CASE
      WHEN realtime.topic() LIKE 'chat:%'
        THEN public.is_conversation_member(
          NULLIF(substring(realtime.topic() FROM 6), '')::uuid,
          auth.uid()
        )
      ELSE true
    END
  );

DROP POLICY IF EXISTS "Authenticated can publish to allowed topics" ON realtime.messages;
CREATE POLICY "Authenticated can publish to allowed topics"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE
      WHEN realtime.topic() LIKE 'chat:%'
        THEN public.is_conversation_member(
          NULLIF(substring(realtime.topic() FROM 6), '')::uuid,
          auth.uid()
        )
      ELSE true
    END
  );

-- 6) Helper to create group conversations atomically (fixes "groups don't work")
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  _name text,
  _member_ids uuid[]
)
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

GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) TO authenticated;

-- Make direct conversation creator a security definer (was failing for some RLS edge cases)
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
