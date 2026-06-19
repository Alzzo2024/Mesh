import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { MeshWord } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { Heart, MessageCircle, ThumbsDown, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Mesh — Feed" }] }),
  component: FeedPage,
});

type Profile = {
  id: string;
  fixed_id: string;
  nickname: string;
  avatar_url: string | null;
};

type Post = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
  likes: number;
  dislikes: number;
  myReaction: "like" | "dislike" | null;
  commentCount: number;
};

async function loadFeed(userId: string): Promise<Post[]> {
  const { data: posts } = await supabase
    .from("posts")
    .select("id, user_id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!posts?.length) return [];

  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const postIds = posts.map((p) => p.id);

  const [profilesRes, reactionsRes, commentsRes] = await Promise.all([
    supabase.from("profiles").select("id, fixed_id, nickname, avatar_url").in("id", userIds),
    supabase.from("post_reactions").select("post_id, user_id, reaction").in("post_id", postIds),
    supabase.from("comments").select("post_id").in("post_id", postIds),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p as Profile]));
  const reactions = reactionsRes.data ?? [];
  const comments = commentsRes.data ?? [];

  return posts.map((p) => {
    const r = reactions.filter((x) => x.post_id === p.id);
    return {
      ...p,
      profile: profileMap.get(p.user_id),
      likes: r.filter((x) => x.reaction === "like").length,
      dislikes: r.filter((x) => x.reaction === "dislike").length,
      myReaction: (r.find((x) => x.user_id === userId)?.reaction as any) ?? null,
      commentCount: comments.filter((c) => c.post_id === p.id).length,
    };
  });
}

function FeedPage() {
  const { t } = useI18n();
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

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

  async function createPost() {
    if (!text.trim() || !me) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({ user_id: me, content: text.trim() });
    setPosting(false);
    if (error) return toast.error(error.message);
    setText("");
  }

  async function react(post: Post, reaction: "like" | "dislike") {
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

      <section className="p-4 border-b border-border">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("feed.placeholder")}
          maxLength={500}
          rows={3}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{text.length}/500</span>
          <button
            onClick={createPost}
            disabled={!text.trim() || posting}
            className="rounded-full bg-primary text-primary-foreground text-sm font-medium px-5 py-2 disabled:opacity-40"
          >
            {t("feed.post")}
          </button>
        </div>
      </section>

      {posts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t("feed.empty")}</p>
      )}

      <ul>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onReact={react} />
        ))}
      </ul>
    </div>
  );
}

function PostCard({ post, onReact }: { post: Post; onReact: (p: Post, r: "like" | "dislike") => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");

  async function loadComments() {
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, content, created_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    if (!data) return;
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, fixed_id, avatar_url")
      .in("id", ids);
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    setComments(data.map((c) => ({ ...c, profile: map.get(c.user_id) })));
  }

  async function sendComment() {
    if (!text.trim()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: user.id, content: text.trim() });
    if (error) return toast.error(error.message);
    setText("");
    loadComments();
  }

  return (
    <li className="px-4 py-4 border-b border-border">
      <div className="flex gap-3">
        <Avatar url={post.profile?.avatar_url} name={post.profile?.nickname} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-foreground truncate">{post.profile?.nickname ?? "?"}</span>
            <span className="text-xs text-muted-foreground">#{post.profile?.fixed_id}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words">{post.content}</p>

          <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
            <button
              onClick={() => onReact(post, "like")}
              className={`flex items-center gap-1.5 ${post.myReaction === "like" ? "text-primary" : ""}`}
            >
              <Heart className="h-4 w-4" /> {post.likes}
            </button>
            <button
              onClick={() => onReact(post, "dislike")}
              className={`flex items-center gap-1.5 ${post.myReaction === "dislike" ? "text-destructive" : ""}`}
            >
              <ThumbsDown className="h-4 w-4" /> {post.dislikes}
            </button>
            <button
              onClick={() => {
                setOpen((o) => !o);
                if (!open) loadComments();
              }}
              className="flex items-center gap-1.5"
            >
              <MessageCircle className="h-4 w-4" /> {post.commentCount}
            </button>
          </div>

          {open && (
            <div className="mt-4 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar url={c.profile?.avatar_url} name={c.profile?.nickname} size={28} />
                  <div className="flex-1">
                    <div className="text-xs">
                      <span className="font-medium">{c.profile?.nickname}</span>{" "}
                      <span className="text-muted-foreground">#{c.profile?.fixed_id}</span>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder={t("feed.commentPlaceholder")}
                  className="flex-1 bg-input border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={sendComment}
                  className="rounded-full bg-primary text-primary-foreground p-2"
                  aria-label="send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
