import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, Settings, LinkIcon, X } from "lucide-react";
import { ImageLightbox } from "@/components/ImageLightbox";
import { resolveSignedUrl, SignedImage } from "@/components/SignedImage";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { CreatorBadge } from "@/components/CreatorBadge";
import { TrustBadge } from "@/components/TrustBadge";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";
import { ensureMyProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mesh — Perfil" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [tab, setTab] = useState<"posts" | "gallery" | "comments">("posts");
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoaded(true);
      return;
    }
    setMe(user.id);
    const p = await ensureMyProfile(user);
    setProfile(p);

    const [ownPostsRes, csRes, fol, fwg, repostsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("id, content, created_at, post_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
      supabase.from("post_reposts").select("post_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    // Hydrate own posts
    let ownHydrated = ownPostsRes.data?.length ? await hydratePosts(ownPostsRes.data as any, user.id) : [];

    // Hydrate reposted posts (fetched separately)
    const repostIds = (repostsRes.data ?? []).map((r) => r.post_id);
    let repostHydrated: FeedPost[] = [];
    if (repostIds.length) {
      const { data: rp } = await supabase
        .from("posts")
        .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
        .in("id", repostIds);
      if (rp?.length) {
        const baseHydrated = await hydratePosts(rp as any, user.id);
        const repostAt = new Map((repostsRes.data ?? []).map((r) => [r.post_id, r.created_at]));
        repostHydrated = baseHydrated.map((b) => ({
          ...b,
          // Mark as repost in the feed
          repostedBy: { fixed_id: p.fixed_id, nickname: p.nickname },
          // Use repost time for sorting
          created_at: repostAt.get(b.id) ?? b.created_at,
        }));
      }
    }

    // Combine: pinned first, then time-merged
    const combined = [...ownHydrated, ...repostHydrated].sort((a, b) => {
      const ap = a.pinned_at && !a.repostedBy ? new Date(a.pinned_at).getTime() : 0;
      const bp = b.pinned_at && !b.repostedBy ? new Date(b.pinned_at).getTime() : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setPosts(combined);
    setComments(csRes.data ?? []);
    setCounts({ followers: fol.count ?? 0, following: fwg.count ?? 0 });
    setLoaded(true);
  }

  async function openSaved() {
    if (!me) return;
    setSavedOpen(true);
    const { data: marks } = await supabase
      .from("post_bookmarks")
      .select("post_id, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false });
    const ids = (marks ?? []).map((m) => m.post_id);
    if (ids.length === 0) {
      setSavedPosts([]);
      return;
    }
    const { data } = await supabase
      .from("posts")
      .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
      .in("id", ids);
    if (!data?.length) {
      setSavedPosts([]);
      return;
    }
    const order = new Map(ids.map((id, index) => [id, index]));
    const hydrated = await hydratePosts(data as any, me);
    setSavedPosts(hydrated.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
  }

  useEffect(() => {
    load();
  }, []);

  if (path !== "/profile") return <Outlet />;

  if (!loaded) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;
  if (!profile) return <p className="p-8 text-center text-muted-foreground">{t("error.generic")}</p>;

  const galleryImages = posts.filter((p) => p.image_path && !p.repostedBy);

  return (
    <div>
      <div className="relative h-40 bg-secondary">
        {profile.banner_url && (
          <SignedImage path={profile.banner_url} className="w-full h-full object-cover" />
        )}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            onClick={openSaved}
            className="md:hidden rounded-full bg-background/80 p-2 flex items-center gap-1.5 text-xs px-3 hover:bg-background"
            aria-label={t("feed.savedPosts")}
          >
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">{t("feed.savedPosts")}</span>
          </button>
          <Link
            to="/profile/settings"
            className="rounded-full bg-background/80 p-2 flex items-center gap-1.5 text-xs px-3 hover:bg-background"
            aria-label={t("profile.editAppearance")}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t("profile.editAppearance")}</span>
          </Link>
        </div>
      </div>

      <div className="px-4 -mt-10 relative">
        <Avatar url={profile.avatar_url} name={profile.nickname} size={80} className="ring-4 ring-background" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{profile.nickname}</h1>
          <TrustBadge targetUserId={profile.id} interactive={false} />
          <CreatorBadge fixedId={profile.fixed_id} />
        </div>
        <p className="text-sm text-muted-foreground font-mono">@{profile.fixed_id}</p>
        {profile.bio && <p className="text-sm mt-2 whitespace-pre-wrap">{profile.bio}</p>}
        {profile.link && (
          <a
            href={profile.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2 break-all"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {profile.link.replace(/^https?:\/\//, "")}
          </a>
        )}
        <div className="flex gap-4 mt-3 text-sm">
          <Link to="/profile/followers" className="hover:underline">
            <strong>{counts.followers}</strong>{" "}
            <span className="text-muted-foreground">{t("follow.followers")}</span>
          </Link>
          <Link to="/profile/following" className="hover:underline">
            <strong>{counts.following}</strong>{" "}
            <span className="text-muted-foreground">{t("follow.following")}</span>
          </Link>
        </div>
      </div>

      <div className="flex border-b border-border mt-4">
        {(["posts", "gallery", "comments"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-3 text-sm font-medium ${
              tab === k ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
            }`}
          >
            {t(`profile.${k}`)}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <ul>{posts.map((p) => <PostCard key={`${p.id}-${p.repostedBy ? "r" : "o"}`} post={p} me={me} onDeleted={load} />)}</ul>
      )}

      {tab === "gallery" && (
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {galleryImages.length === 0 && (
            <p className="col-span-3 text-center text-muted-foreground py-8 text-sm">—</p>
          )}
          {galleryImages.map((p) => (
            <button
              key={p.id}
              onClick={async () => {
                if (!p.image_path) return;
                const url = await resolveSignedUrl(p.image_path);
                if (url) setLightbox(url);
              }}
              className="relative aspect-square overflow-hidden bg-secondary"
            >
              <SignedImage path={p.image_path!} className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform" />
            </button>
          ))}
        </div>
      )}

      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {savedOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center p-3"
          onClick={() => setSavedOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
              <h2 className="font-semibold">{t("feed.savedPosts")}</h2>
              <button onClick={() => setSavedOpen(false)} className="rounded-full p-2 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </header>
            {savedPosts.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">{t("search.empty")}</p>
            ) : (
              <ul>
                {savedPosts.map((p) => (
                  <PostCard key={p.id} post={p} me={me} onDeleted={openSaved} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "comments" && (
        <ul>
          {comments.map((item) => (
            <li key={item.id} className="border-b border-border">
              <Link to="/post/$id" params={{ id: item.post_id }} className="block px-4 py-3 hover:bg-secondary/40">
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {new Date(item.created_at).toLocaleDateString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
