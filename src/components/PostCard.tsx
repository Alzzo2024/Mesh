import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, ThumbsDown, Send, Trash2, MoreHorizontal, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { SignedImage } from "@/components/SignedImage";
import { extractHashtags, tokenizeHashtags } from "@/lib/hashtags";
import { TrustBadge } from "@/components/TrustBadge";
import { toast } from "sonner";

export type FeedProfile = {
  id: string;
  fixed_id: string;
  nickname: string;
  avatar_url: string | null;
  trust_score?: number;
};

export type FeedPost = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  image_path: string | null;
  hashtags: string[];
  profile?: FeedProfile;
  likes: number;
  dislikes: number;
  myReaction: "like" | "dislike" | null;
  commentCount: number;
};

type CommentRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profile?: FeedProfile;
};

function HashtagText({ text }: { text: string }) {
  return (
    <>
      {tokenizeHashtags(text).map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <Link
            key={i}
            to="/hashtag/$tag"
            params={{ tag: part.tag.toLowerCase() }}
            className="text-primary hover:underline"
          >
            #{part.tag}
          </Link>
        ),
      )}
    </>
  );
}

async function fetchTrustScores(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, number>();
  const { data } = await supabase.from("trust_votes").select("target_user_id").in("target_user_id", userIds);
  const scores = new Map<string, number>();
  for (const row of data ?? []) {
    scores.set(row.target_user_id, (scores.get(row.target_user_id) ?? 0) + 1);
  }
  return scores;
}

export function PostCard({
  post,
  me,
  onReact,
  onDeleted,
}: {
  post: FeedPost;
  me: string | null;
  onReact: (p: FeedPost, r: "like" | "dislike") => void;
  onDeleted?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);

  async function loadComments() {
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, content, created_at, parent_id")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    if (!data) return;
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, fixed_id, avatar_url")
      .in("id", ids);
    const trustScores = await fetchTrustScores(ids);
    const map = new Map(
      (profiles ?? []).map((p) => [p.id, { ...(p as FeedProfile), trust_score: trustScores.get(p.id) ?? 0 }]),
    );
    setComments(data.map((c) => ({ ...c, profile: map.get(c.user_id) })));
  }

  useEffect(() => {
    if (open) loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function sendComment() {
    if (!text.trim() || !me) return;
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: me, content: text.trim(), parent_id: replyTo });
    if (error) return toast.error(error.message);
    setText("");
    setReplyTo(null);
    loadComments();
  }

  async function deleteComment(id: string) {
    if (!confirm(t("feed.deleteCommentConfirm"))) return;
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadComments();
  }

  async function deletePost() {
    if (!confirm(t("feed.deletePostConfirm"))) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    onDeleted?.();
  }

  async function saveEdit() {
    const content = editText.trim();
    if (!content) return;
    const { error } = await supabase
      .from("posts")
      .update({ content, hashtags: extractHashtags(content) })
      .eq("id", post.id);
    if (error) return toast.error(error.message);
    setEditing(false);
    setMenuOpen(false);
    onDeleted?.();
  }

  const topComments = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const arr = repliesByParent.get(c.parent_id) ?? [];
      arr.push(c);
      repliesByParent.set(c.parent_id, arr);
    }
  }

  return (
    <li className="px-4 py-4 border-b border-border">
      <div className="flex gap-3">
        <Link to="/u/$fixedId" params={{ fixedId: post.profile?.fixed_id ?? "" }}>
          <Avatar url={post.profile?.avatar_url} name={post.profile?.nickname} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <Link
              to="/u/$fixedId"
              params={{ fixedId: post.profile?.fixed_id ?? "" }}
              className="font-medium text-foreground truncate hover:underline"
            >
              {post.profile?.nickname ?? "?"}
            </Link>
            <span className="text-xs text-muted-foreground">#{post.profile?.fixed_id}</span>
            {me === post.user_id && (
              <button
                onClick={deletePost}
                className="ml-auto p-1 text-muted-foreground hover:text-destructive"
                aria-label={t("feed.delete")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words">
            <HashtagText text={post.content} />
          </p>
          {post.image_path && (
            <SignedImage
              path={post.image_path}
              className="mt-3 rounded-xl max-h-96 w-full object-cover border border-border"
            />
          )}

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
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> {post.commentCount}
            </button>
          </div>

          {open && (
            <div className="mt-4 space-y-3">
              {topComments.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  replies={repliesByParent.get(c.id) ?? []}
                  me={me}
                  onReply={(id) => setReplyTo(id)}
                  onDelete={deleteComment}
                />
              ))}
              {replyTo && (
                <p className="text-xs text-muted-foreground">
                  ↳ {t("feed.reply")}{" "}
                  <button onClick={() => setReplyTo(null)} className="underline">
                    {t("common.cancel")}
                  </button>
                </p>
              )}
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder={replyTo ? t("feed.replyPlaceholder") : t("feed.commentPlaceholder")}
                  className="flex-1 bg-input border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={sendComment}
                  className="rounded-full bg-primary text-[#1a1a1a] p-2"
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

function CommentItem({
  comment,
  replies,
  me,
  onReply,
  onDelete,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  me: string | null;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <div className="flex gap-2">
        <Avatar url={comment.profile?.avatar_url} name={comment.profile?.nickname} size={28} />
        <div className="flex-1">
          <div className="text-xs flex items-center gap-2">
            <span className="font-medium">{comment.profile?.nickname}</span>
            <span className="text-muted-foreground">#{comment.profile?.fixed_id}</span>
            {me === comment.user_id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="ml-auto text-muted-foreground hover:text-destructive"
                aria-label={t("feed.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm">{comment.content}</p>
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-muted-foreground hover:text-primary mt-0.5"
          >
            {t("feed.reply")}
          </button>
        </div>
      </div>
      {replies.length > 0 && (
        <div className="ml-10 mt-2 space-y-2 border-l border-border pl-3">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2">
              <Avatar url={r.profile?.avatar_url} name={r.profile?.nickname} size={24} />
              <div className="flex-1">
                <div className="text-xs flex items-center gap-2">
                  <span className="font-medium">{r.profile?.nickname}</span>
                  <span className="text-muted-foreground">#{r.profile?.fixed_id}</span>
                  {me === r.user_id && (
                    <button
                      onClick={() => onDelete(r.id)}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-sm">{r.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export async function loadFeed(userId: string, postIds?: string[]): Promise<FeedPost[]> {
  let q = supabase
    .from("posts")
    .select("id, user_id, content, created_at, image_path, hashtags")
    .order("created_at", { ascending: false })
    .limit(100);
  if (postIds) q = q.in("id", postIds);
  const { data: posts } = await q;
  if (!posts?.length) return [];

  return await hydratePosts(posts as any, userId);
}

export async function hydratePosts(
  posts: Array<Pick<FeedPost, "id" | "user_id" | "content" | "created_at" | "image_path" | "hashtags">>,
  userId: string,
): Promise<FeedPost[]> {
  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const postIds = posts.map((p) => p.id);
  const [profilesRes, reactionsRes, commentsRes] = await Promise.all([
    supabase.from("profiles").select("id, fixed_id, nickname, avatar_url").in("id", userIds),
    supabase.from("post_reactions").select("post_id, user_id, reaction").in("post_id", postIds),
    supabase.from("comments").select("post_id").in("post_id", postIds),
  ]);
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p as FeedProfile]));
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
