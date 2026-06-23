import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/hashtag/$tag")({
  head: ({ params }) => ({ meta: [{ title: `Mesh — #${params.tag}` }] }),
  component: HashtagPage,
});

function HashtagPage() {
  const { tag } = Route.useParams();
  const { t } = useI18n();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [me, setMe] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data } = await supabase
      .from("posts")
      .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
      .contains("hashtags", [tag.toLowerCase()])
      .order("created_at", { ascending: false })
      .limit(100);
    if (data?.length) setPosts(await hydratePosts(data as any, user.id));
    else setPosts([]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  async function react(post: FeedPost, reaction: "like" | "dislike") {
    if (!me) return;
    if (post.myReaction === reaction) {
      await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("user_id", me);
    } else {
      await supabase
        .from("post_reactions")
        .upsert({ post_id: post.id, user_id: me, reaction }, { onConflict: "post_id,user_id" });
    }
    load();
  }

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/feed" className="p-2 -ml-1 rounded-full hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">#{tag}</h1>
      </header>
      {posts.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">{t("search.empty")}</p>
      ) : (
        <ul>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} me={me} onReact={react} onDeleted={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
