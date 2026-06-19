
-- Fix search_path on generate_fixed_id
CREATE OR REPLACE FUNCTION public.generate_fixed_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
BEGIN
  result := '';
  FOR i IN 1..6 LOOP
    result := result || substr(alphabet, (floor(random() * length(alphabet)) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Revoke generate_fixed_id from public/anon/authenticated (only trigger uses it as definer)
REVOKE EXECUTE ON FUNCTION public.generate_fixed_id() FROM PUBLIC, anon, authenticated;

-- is_conversation_member: keep authenticated execute (used in RLS via auth.uid())
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;

-- get_or_create_direct_conversation: only authenticated
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;

-- handle_new_user is trigger-attached on auth.users; revoke direct execute
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- =========================
-- Storage policies
-- =========================

-- AVATARS: anyone authenticated can read; users upload to {auth.uid()}/*
CREATE POLICY "Avatars readable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- BANNERS
CREATE POLICY "Banners readable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'banners');
CREATE POLICY "Users upload own banner"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own banner"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own banner"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);

-- MESSAGE MEDIA: authenticated upload own folder; read for any authenticated (kept simple for MVP)
CREATE POLICY "Message media readable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-media');
CREATE POLICY "Users upload own message media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own message media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'message-media' AND (storage.foldername(name))[1] = auth.uid()::text);
