import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Mesh — Guardados" }] }),
  component: SavedPage,
});

function SavedPage() {
  const { t } = useI18n();
  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data: marks } = await supabase
      .from("post_bookmarks")
      .select("post_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const ids = (marks ?? []).map((m) => m.post_id);
    if (!ids.length) {
      setPosts([]);
      setLoaded(true);
      return;
    }
    const { data } = await supabase
      .from("posts")
      .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
      .in("id", ids);
    if (!data?.length) {
      setPosts([]);
      setLoaded(true);
      return;
    }
    const order = new Map(ids.map((id, i) => [id, i]));
    const hydrated = await hydratePosts(data as any, user.id);
    setPosts(hydrated.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
    setLoaded(true);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">{t("nav.saved")}</h1>
      </header>
      {!loaded && <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>}
      {loaded && posts.length === 0 && (
        <p className="p-8 text-center text-muted-foreground">{t("search.empty")}</p>
      )}
      <ul>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} onDeleted={load} />
        ))}
      </ul>
    </div>
  );
}
