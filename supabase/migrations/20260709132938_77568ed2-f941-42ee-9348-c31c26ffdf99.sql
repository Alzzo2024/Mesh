
-- Allow group admins to upload/manage group avatars in the avatars bucket under group-<conv_id>/*
DROP POLICY IF EXISTS "Group admins can upload group avatars" ON storage.objects;
CREATE POLICY "Group admins can upload group avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] LIKE 'group-%'
  AND EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.user_id = auth.uid()
      AND m.is_admin = true
      AND m.conversation_id::text = substring((storage.foldername(name))[1] FROM 7)
  )
);

DROP POLICY IF EXISTS "Group admins can update group avatars" ON storage.objects;
CREATE POLICY "Group admins can update group avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] LIKE 'group-%'
  AND EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.user_id = auth.uid()
      AND m.is_admin = true
      AND m.conversation_id::text = substring((storage.foldername(name))[1] FROM 7)
  )
);

DROP POLICY IF EXISTS "Members can read group avatars" ON storage.objects;
CREATE POLICY "Members can read group avatars"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] LIKE 'group-%'
      AND EXISTS (
        SELECT 1 FROM public.conversation_members m
        WHERE m.user_id = auth.uid()
          AND m.conversation_id::text = substring((storage.foldername(name))[1] FROM 7)
      )
    )
  )
);
