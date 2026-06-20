import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/post/$id")({
  head: () => ({ meta: [{ title: "Mesh — Publicação" }] }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const [me, setMe] = useState<string | null>(null);
  const [post, setPost] = useState<FeedPost | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data } = await supabase
      .from("posts")
      .select("id, user_id, content, created_at, image_path, hashtags")
      .eq("id", id)
      .maybeSingle();
    if (!data) return setPost(null);
    const hydrated = await hydratePosts([data as any], user.id);
    setPost(hydrated[0] ?? null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function react(p: FeedPost, reaction: "like" | "dislike") {
    if (!me) return;
    if (p.myReaction === reaction) {
      await supabase.from("post_reactions").delete().eq("post_id", p.id).eq("user_id", me);
    } else {
      await supabase
        .from("post_reactions")
        .upsert({ post_id: p.id, user_id: me, reaction }, { onConflict: "post_id,user_id" });
    }
    load();
  }

  return (
    <div>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Link to="/feed" className="-ml-1 rounded-full p-2 hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">{t("post.title")}</h1>
      </header>
      {post ? (
        <ul>
          <PostCard post={post} me={me} onReact={react} onDeleted={() => history.back()} />
        </ul>
      ) : (
        <p className="p-8 text-center text-muted-foreground">{t("search.empty")}</p>
      )}
    </div>
  );
}