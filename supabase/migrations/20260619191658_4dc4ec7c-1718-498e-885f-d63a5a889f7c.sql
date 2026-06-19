-- Follows (one-directional)
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows viewable by authenticated" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own follows" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users delete own follows" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Posts: image + hashtags
ALTER TABLE public.posts ADD COLUMN image_path text;
ALTER TABLE public.posts ADD COLUMN hashtags text[] NOT NULL DEFAULT '{}';
CREATE INDEX idx_posts_hashtags ON public.posts USING GIN (hashtags);

-- Comments: replies
ALTER TABLE public.comments ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
CREATE INDEX idx_comments_parent ON public.comments(parent_id);

-- Storage policies for post-media bucket
CREATE POLICY "Authenticated read post-media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-media');
CREATE POLICY "Users upload own post-media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own post-media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;