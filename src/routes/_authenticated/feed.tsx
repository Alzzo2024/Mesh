import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { MeshWord } from "@/components/Logo";
import { PostCard, loadFeed, hydratePosts, type FeedPost } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { SideBlocks } from "@/components/SideBlocks";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Mesh — Feed" }] }),
  component: FeedPage,
});

function FeedPage() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [tab, setTab] = useState<"forYou" | "following">("forYou");

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    if (tab === "forYou") {
      setPosts(await loadFeed(user.id));
    } else {
      const { data: fol } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const ids = (fol ?? []).map((f) => f.following_id);
      if (!ids.length) {
        setPosts([]);
        return;
      }
      const { data } = await supabase
        .from("posts")
        .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!data?.length) {
        setPosts([]);
        return;
      }
      setPosts(await hydratePosts(data as any, user.id));
    }
  }

  useEffect(() => {
    refresh();
    const onOpen = () => setComposerOpen(true);
    window.addEventListener("mesh:open-composer", onOpen);
    return () => window.removeEventListener("mesh:open-composer", onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      <aside className="hidden lg:block fixed right-6 top-6 w-80">
        <SideBlocks refreshKey={posts.length} />
      </aside>

      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="md:hidden px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl text-primary">
            <MeshWord />
          </h1>
        </div>
        <div className="flex">
          {(["forYou", "following"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === k ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`feed.tab.${k}`)}
            </button>
          ))}
        </div>
      </header>

      {posts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          {tab === "following" ? t("feed.tab.followingEmpty") : t("feed.empty")}
        </p>
      )}

      <ul>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} onDeleted={refresh} />
        ))}
      </ul>

      <button
        onClick={() => setComposerOpen(true)}
        className="md:hidden fixed right-4 z-30 rounded-full bg-primary text-[#1a1a1a] shadow-lg h-14 w-14 flex items-center justify-center hover:scale-105 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
        aria-label={t("feed.newPost")}
      >
        <Pencil className="h-6 w-6" />
      </button>

      <PostComposer open={composerOpen} onClose={() => setComposerOpen(false)} onPosted={refresh} />
    </div>
  );
}
