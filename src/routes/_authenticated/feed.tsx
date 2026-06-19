import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { MeshWord } from "@/components/Logo";
import { PostCard, loadFeed, type FeedPost } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Mesh — Feed" }] }),
  component: FeedPage,
});

function FeedPage() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    setPosts(await loadFeed(user.id));
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function react(post: FeedPost, reaction: "like" | "dislike") {
    if (!me) return;
    if (post.myReaction === reaction) {
      await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("user_id", me);
    } else {
      await supabase
        .from("post_reactions")
        .upsert({ post_id: post.id, user_id: me, reaction }, { onConflict: "post_id,user_id" });
    }
    refresh();
  }

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl text-primary">
          <MeshWord />
        </h1>
      </header>

      {posts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t("feed.empty")}</p>
      )}

      <ul>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} onReact={react} onDeleted={refresh} />
        ))}
      </ul>

      <button
        onClick={() => setComposerOpen(true)}
        className="fixed right-4 z-30 rounded-full bg-primary text-[#1a1a1a] shadow-lg h-14 w-14 flex items-center justify-center hover:scale-105 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
        aria-label={t("feed.newPost")}
      >
        <Pencil className="h-6 w-6" />
      </button>

      <PostComposer open={composerOpen} onClose={() => setComposerOpen(false)} onPosted={refresh} />
    </div>
  );
}
