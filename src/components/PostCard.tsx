import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, ThumbsDown, Send, Trash2, MoreHorizontal, Pencil, X, Pin, Share2, Link2, Repeat2, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { SignedImage, resolveSignedUrl } from "@/components/SignedImage";
import { extractHashtags, tokenizeHashtags } from "@/lib/hashtags";
import { TrustBadge } from "@/components/TrustBadge";
import { ImageLightbox } from "@/components/ImageLightbox";
import { EmojiPicker } from "@/components/EmojiPicker";
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
  pinned_at?: string | null;
  profile?: FeedProfile;
  likes: number;
  dislikes: number;
  myReaction: "like" | "dislike" | null;
  commentCount: number;
  repostCount: number;
  myRepost: boolean;
  /** When this post is shown because someone else reposted it */
  repostedBy?: { fixed_id: string; nickname: string } | null;
};

type CommentRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profile?: FeedProfile;
};

const CONTENT_TOKEN_RE = /(^|[^@\w])@([A-Za-z0-9]{1,10})\b|#([\p{L}0-9_]{1,40})/gu;

function ContentText({ text }: { text: string }) {
  const parts: Array<string | { type: "mention"; id: string } | { type: "hashtag"; tag: string }> = [];
  let last = 0;
  for (const match of text.matchAll(CONTENT_TOKEN_RE)) {
    if (match[2]) {
      const pre = match[1] ?? "";
      const tokenStart = match.index! + pre.length;
      if (tokenStart > last) parts.push(text.slice(last, tokenStart));
      parts.push({ type: "mention", id: match[2].toUpperCase() });
      last = tokenStart + match[2].length + 1;
      continue;
    }
    if (match[3]) {
      if (match.index! > last) parts.push(text.slice(last, match.index));
      parts.push({ type: "hashtag", tag: match[3] });
      last = match.index! + match[0].length;
    }
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : part.type === "mention" ? (
          <Link
            key={i}
            to="/u/$fixedId"
            params={{ fixedId: part.id }}
            className="text-primary hover:underline"
          >
            @{part.id}
          </Link>
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
  onReact?: (p: FeedPost, r: "like" | "dislike") => void;
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
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Local optimistic reaction state — keeps clicks instant + consistent
  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(post.myReaction);
  const [likes, setLikes] = useState(post.likes);
  const [dislikes, setDislikes] = useState(post.dislikes);
  useEffect(() => {
    setMyReaction(post.myReaction);
    setLikes(post.likes);
    setDislikes(post.dislikes);
  }, [post.id, post.myReaction, post.likes, post.dislikes]);

  async function react(reaction: "like" | "dislike") {
    if (!me) return;
    const prev = myReaction;
    // optimistic local update
    if (prev === reaction) {
      setMyReaction(null);
      if (reaction === "like") setLikes((n) => Math.max(0, n - 1));
      else setDislikes((n) => Math.max(0, n - 1));
    } else {
      setMyReaction(reaction);
      if (reaction === "like") {
        setLikes((n) => n + 1);
        if (prev === "dislike") setDislikes((n) => Math.max(0, n - 1));
      } else {
        setDislikes((n) => n + 1);
        if (prev === "like") setLikes((n) => Math.max(0, n - 1));
      }
    }
    // server sync
    if (prev === reaction) {
      const { error } = await supabase
        .from("post_reactions")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", me);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("post_reactions")
        .upsert({ post_id: post.id, user_id: me, reaction }, { onConflict: "post_id,user_id" });
      if (error) toast.error(error.message);
    }
    onReact?.(post, reaction);
  }

  async function openLightbox() {
    if (!post.image_path) return;
    const url = await resolveSignedUrl(post.image_path);
    if (url) setLightbox(url);
  }

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

  const [pinned, setPinned] = useState<boolean>(!!post.pinned_at);
  useEffect(() => setPinned(!!post.pinned_at), [post.pinned_at]);

  async function togglePin() {
    setMenuOpen(false);
    const next = pinned ? null : new Date().toISOString();
    const { error } = await supabase.from("posts").update({ pinned_at: next }).eq("id", post.id);
    if (error) {
      if (error.message.includes("PIN_LIMIT_REACHED")) toast.error(t("feed.pinLimit"));
      else toast.error(error.message);
      return;
    }
    setPinned(!pinned);
    onDeleted?.();
  }

  // Repost state (optimistic)
  const [myRepost, setMyRepost] = useState<boolean>(post.myRepost);
  const [repostCount, setRepostCount] = useState<number>(post.repostCount);
  useEffect(() => {
    setMyRepost(post.myRepost);
    setRepostCount(post.repostCount);
  }, [post.id, post.myRepost, post.repostCount]);

  async function toggleRepost() {
    if (!me) return;
    if (post.user_id === me) {
      toast.error("—");
      return;
    }
    const next = !myRepost;
    setMyRepost(next);
    setRepostCount((n) => Math.max(0, n + (next ? 1 : -1)));
    if (next) {
      const { error } = await supabase
        .from("post_reposts")
        .insert({ user_id: me, post_id: post.id });
      if (error && !error.message.includes("duplicate")) {
        setMyRepost(false);
        setRepostCount((n) => Math.max(0, n - 1));
        toast.error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("post_reposts")
        .delete()
        .eq("user_id", me)
        .eq("post_id", post.id);
      if (error) {
        setMyRepost(true);
        setRepostCount((n) => n + 1);
        toast.error(error.message);
      }
    }
    onDeleted?.();
  }

  const [shareOpen, setShareOpen] = useState(false);
  const [shareToOpen, setShareToOpen] = useState(false);
  const [shareFriends, setShareFriends] = useState<Array<{ id: string; nickname: string; fixed_id: string; avatar_url: string | null }>>([]);
  async function copyLink() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("feed.linkCopied"));
    } catch {
      toast.error("—");
    }
    setShareOpen(false);
  }
  async function openShareTo() {
    setShareOpen(false);
    if (!me) return;
    const { data: fr } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
    const friendIds = (fr ?? [])
      .filter((f) => f.status === "accepted")
      .map((f) => (f.requester_id === me ? f.addressee_id : f.requester_id));
    if (friendIds.length === 0) {
      setShareFriends([]);
      setShareToOpen(true);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nickname, fixed_id, avatar_url")
      .in("id", friendIds);
    setShareFriends(profs ?? []);
    setShareToOpen(true);
  }
  async function sendToFriend(friendId: string) {
    if (!me) return;
    const { data: convId, error: e1 } = await supabase.rpc("get_or_create_direct_conversation", {
      _other_user: friendId,
    });
    if (e1 || !convId) {
      toast.error(e1?.message ?? "—");
      return;
    }
    const url = `${window.location.origin}/post/${post.id}`;
    const { error } = await supabase.from("messages").insert({
      conversation_id: convId as string,
      sender_id: me,
      content: `${t("chats.sharedPost")}: ${url}`,
    });
    if (error) toast.error(error.message);
    else toast.success(t("feed.linkCopied"));
    setShareToOpen(false);
  }

  // Bookmark state
  const [bookmarked, setBookmarked] = useState(false);
  useEffect(() => {
    if (!me) return;
    (async () => {
      const { data } = await supabase
        .from("post_bookmarks")
        .select("post_id")
        .eq("user_id", me)
        .eq("post_id", post.id)
        .maybeSingle();
      setBookmarked(!!data);
    })();
  }, [me, post.id]);
  async function toggleBookmark() {
    if (!me) return;
    const next = !bookmarked;
    setBookmarked(next);
    if (next) {
      const { error } = await supabase.from("post_bookmarks").insert({ user_id: me, post_id: post.id });
      if (error && !error.message.includes("duplicate")) {
        setBookmarked(false);
        toast.error(error.message);
      } else toast.success(t("feed.bookmarked"));
    } else {
      const { error } = await supabase
        .from("post_bookmarks")
        .delete()
        .eq("user_id", me)
        .eq("post_id", post.id);
      if (error) {
        setBookmarked(true);
        toast.error(error.message);
      }
    }
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
      {post.repostedBy && (
        <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Repeat2 className="h-3 w-3" /> {t("feed.repostedBy")}{" "}
          <Link to="/u/$fixedId" params={{ fixedId: post.repostedBy.fixed_id }} className="hover:underline">
            @{post.repostedBy.fixed_id}
          </Link>
        </div>
      )}
      {pinned && !post.repostedBy && (
        <div className="mb-1 flex items-center gap-1 text-xs text-primary">
          <Pin className="h-3 w-3" /> {t("feed.pinned")}
        </div>
      )}
      <div className="flex gap-3">
        <Link to="/u/$fixedId" params={{ fixedId: post.profile?.fixed_id ?? "" }}>
          <Avatar url={post.profile?.avatar_url} name={post.profile?.nickname} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link
                  to="/u/$fixedId"
                  params={{ fixedId: post.profile?.fixed_id ?? "" }}
                  className="truncate font-medium text-foreground hover:underline"
                >
                  {post.profile?.nickname ?? "?"}
                </Link>
                <TrustBadge
                  targetUserId={post.user_id}
                  initialScore={post.profile?.trust_score ?? 0}
                  interactive={me !== post.user_id}
                  compact
                />
              </div>
              <span className="block text-xs text-muted-foreground">@{post.profile?.fixed_id}</span>
            </div>
            {me === post.user_id && (
              <div className="relative ml-auto">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label={t("feed.actions")}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-7 z-20 min-w-40 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                    <button
                      onClick={togglePin}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <Pin className="h-4 w-4" /> {pinned ? t("feed.unpin") : t("feed.pin")}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <Pencil className="h-4 w-4" /> {t("feed.edit")}
                    </button>
                    <button
                      onClick={deletePost}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-secondary"
                    >
                      <Trash2 className="h-4 w-4" /> {t("feed.delete")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="rounded-full bg-secondary px-3 py-1.5 text-sm">
                  <X className="inline h-3.5 w-3.5" /> {t("common.cancel")}
                </button>
                <button onClick={saveEdit} className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-[#1a1a1a]">
                  {t("settings.save")}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words">
              <ContentText text={post.content} />
            </p>
          )}
          <Link to="/post/$id" params={{ id: post.id }} className="mt-1 inline-block text-xs text-muted-foreground hover:text-primary">
            {new Date(post.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {new Date(post.created_at).toLocaleDateString()}
          </Link>
          {post.image_path && (
            <button type="button" onClick={openLightbox} className="mt-3 block w-full">
              <SignedImage
                path={post.image_path}
                className="rounded-xl max-h-96 w-full object-cover border border-border cursor-zoom-in"
              />
            </button>
          )}
          {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}

          <div className="flex items-center gap-5 mt-3 text-sm text-muted-foreground">
            <button
              onClick={() => react("like")}
              className={`flex items-center gap-1.5 ${myReaction === "like" ? "text-primary" : ""}`}
            >
              <Heart className="h-4 w-4" /> {likes}
            </button>
            <button
              onClick={() => react("dislike")}
              className={`flex items-center gap-1.5 ${myReaction === "dislike" ? "text-destructive" : ""}`}
            >
              <ThumbsDown className="h-4 w-4" /> {dislikes}
            </button>
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> {post.commentCount}
            </button>
            <button
              onClick={toggleRepost}
              className={`flex items-center gap-1.5 ${myRepost ? "text-primary" : ""}`}
              aria-label={t("feed.repost")}
            >
              <Repeat2 className="h-4 w-4" /> {repostCount}
            </button>
            <div className="flex-1" />
            <button
              onClick={toggleBookmark}
              className={`flex items-center gap-1.5 hover:text-foreground ${bookmarked ? "text-primary" : ""}`}
              aria-label={t("feed.bookmark")}
            >
              <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShareOpen((v) => !v)}
                className="flex items-center gap-1.5 hover:text-foreground"
                aria-label={t("feed.share")}
              >
                <Share2 className="h-4 w-4" />
              </button>
              {shareOpen && (
                <div className="absolute bottom-full right-0 mb-2 z-20 min-w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                  <button
                    onClick={copyLink}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <Link2 className="h-4 w-4" /> {t("feed.copyLink")}
                  </button>
                  <button
                    onClick={openShareTo}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <Send className="h-4 w-4" /> {t("feed.shareToChat")}
                  </button>
                </div>
              )}
            </div>
          </div>
          {shareToOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-3"
              onClick={() => setShareToOpen(false)}
            >
              <div
                className="w-full md:max-w-sm rounded-2xl bg-popover border border-border p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold mb-2">{t("chats.chooseFriend")}</h3>
                {shareFriends.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">—</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {shareFriends.map((f) => (
                      <li key={f.id}>
                        <button
                          onClick={() => sendToFriend(f.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary text-left"
                        >
                          <Avatar url={f.avatar_url} name={f.nickname} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{f.nickname}</div>
                            <div className="truncate text-xs text-muted-foreground">@{f.fixed_id}</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder={replyTo ? t("feed.replyPlaceholder") : t("feed.commentPlaceholder")}
                  className="flex-1 bg-input border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <EmojiPicker onPick={(e) => setText((t) => t + e)} />
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
            <TrustBadge
              targetUserId={comment.user_id}
              initialScore={comment.profile?.trust_score ?? 0}
              interactive={me !== comment.user_id}
              compact
            />
            <span className="block text-muted-foreground">@{comment.profile?.fixed_id}</span>
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
                  <TrustBadge
                    targetUserId={r.user_id}
                    initialScore={r.profile?.trust_score ?? 0}
                    interactive={me !== r.user_id}
                    compact
                  />
                  <span className="text-muted-foreground">@{r.profile?.fixed_id}</span>
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
    .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (postIds) q = q.in("id", postIds);
  const { data: posts } = await q;
  if (!posts?.length) return [];

  const hydrated = await hydratePosts(posts as any, userId);
  return hydrated.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function hydratePosts(
  posts: Array<Pick<FeedPost, "id" | "user_id" | "content" | "created_at" | "image_path" | "hashtags"> & { pinned_at?: string | null }>,
  userId: string,
): Promise<FeedPost[]> {
  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const postIds = posts.map((p) => p.id);
  const [profilesRes, reactionsRes, commentsRes, repostsRes, trustScores] = await Promise.all([
    supabase.from("profiles").select("id, fixed_id, nickname, avatar_url").in("id", userIds),
    supabase.from("post_reactions").select("post_id, user_id, reaction").in("post_id", postIds),
    supabase.from("comments").select("post_id").in("post_id", postIds),
    supabase.from("post_reposts").select("post_id, user_id").in("post_id", postIds),
    fetchTrustScores(userIds),
  ]);
  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, { ...(p as FeedProfile), trust_score: trustScores.get(p.id) ?? 0 }]),
  );
  const reactions = reactionsRes.data ?? [];
  const comments = commentsRes.data ?? [];
  const reposts = repostsRes.data ?? [];
  return posts.map((p) => {
    const r = reactions.filter((x) => x.post_id === p.id);
    const rp = reposts.filter((x) => x.post_id === p.id);
    return {
      ...p,
      profile: profileMap.get(p.user_id),
      likes: r.filter((x) => x.reaction === "like").length,
      dislikes: r.filter((x) => x.reaction === "dislike").length,
      myReaction: (r.find((x) => x.user_id === userId)?.reaction as any) ?? null,
      commentCount: comments.filter((c) => c.post_id === p.id).length,
      repostCount: rp.length,
      myRepost: rp.some((x) => x.user_id === userId),
    };
  });
}
