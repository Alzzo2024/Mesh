CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_members
      WHERE conversation_id = _conversation_id
        AND user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated can use chat topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can publish to chat topics" ON realtime.messages;

CREATE POLICY "Authenticated can use chat topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'chat:%'
  AND public.is_conversation_member(NULLIF(SUBSTRING(realtime.topic() FROM 6), '')::uuid, auth.uid())
);

CREATE POLICY "Authenticated can publish to chat topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'chat:%'
  AND public.is_conversation_member(NULLIF(SUBSTRING(realtime.topic() FROM 6), '')::uuid, auth.uid())
);