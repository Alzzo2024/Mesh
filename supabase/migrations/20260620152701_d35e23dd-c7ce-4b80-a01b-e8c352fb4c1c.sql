DROP POLICY IF EXISTS "Creators view own new conversations" ON public.conversations;
CREATE POLICY "Creators view own new conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (created_by = auth.uid());