import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { SignedImage, resolveSignedUrl } from "@/components/SignedImage";
import { FollowButton } from "@/components/FollowButton";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";
import { CreatorBadge } from "@/components/CreatorBadge";
import { TrustBadge } from "@/components/TrustBadge";
import { ImageLightbox } from "@/components/ImageLightbox";
import { useI18n } from "@/lib/i18n";
import { PROFILE_SAFE_SELECT } from "@/lib/profile";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/u/$fixedId")({
  head: ({ params }) => ({ meta: [{ title: `Mesh — @${params.fixedId}` }] }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { fixedId } = Route.useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<any>(null);
  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [tab, setTab] = useState<"posts" | "gallery">("posts");
  const [lightbox, setLightbox] = useState<string | null>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMe(user?.id ?? null);

    const { data: p } = await supabase
      .from("profiles")
      .select(PROFILE_SAFE_SELECT)
      .eq("fixed_id", fixedId.toUpperCase())
      .maybeSingle();
    if (!p) return;
    setProfile(p);

    if (user?.id === p.id) {
      navigate({ to: "/profile", replace: true });
      return;
    }

    const [{ data: ps }, fol, fwg, repostsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
        .eq("user_id", p.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
      supabase.from("post_reposts").select("post_id, created_at").eq("user_id", p.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setCounts({ followers: fol.count ?? 0, following: fwg.count ?? 0 });

    if (!user) {
      setPosts([]);
      return;
    }

    const ownHydrated = ps?.length ? await hydratePosts(ps as any, user.id) : [];
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
          repostedBy: { fixed_id: p.fixed_id, nickname: p.nickname },
          created_at: repostAt.get(b.id) ?? b.created_at,
        }));
      }
    }
    const combined = [...ownHydrated, ...repostHydrated].sort((a, b) => {
      const ap = a.pinned_at && !a.repostedBy ? new Date(a.pinned_at).getTime() : 0;
      const bp = b.pinned_at && !b.repostedBy ? new Date(b.pinned_at).getTime() : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setPosts(combined);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedId]);

  async function openChat() {
    if (!profile) return;
    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
      _other_user: profile.id,
    });
    if (error) return toast.error(error.message);
    navigate({ to: "/conversations/$id", params: { id: data as string } });
  }

  if (path !== `/u/${fixedId}`) return <Outlet />;
  if (!profile) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;

  const galleryImages = posts.filter((p) => p.image_path && !p.repostedBy);

  return (
    <div>
      <div className="relative h-40 bg-secondary">
        {profile.banner_url && (
          <SignedImage path={profile.banner_url} className="w-full h-full object-cover" />
        )}
        <Link to="/feed" className="absolute top-3 left-3 rounded-full bg-background/80 p-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      <div className="px-4 -mt-10 relative">
        <Avatar url={profile.avatar_url} name={profile.nickname} size={80} className="ring-4 ring-background" />
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold truncate">{profile.nickname}</h1>
              <TrustBadge targetUserId={profile.id} interactive={me !== profile.id} />
              <CreatorBadge fixedId={profile.fixed_id} />
            </div>
            <p className="text-sm text-muted-foreground font-mono">@{profile.fixed_id}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openChat}
              className="rounded-full border border-border p-2 hover:bg-secondary"
              aria-label="chat"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <FollowButton targetUserId={profile.id} />
          </div>
        </div>
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
          <Link to="/u/$fixedId/followers" params={{ fixedId: profile.fixed_id }} className="hover:underline">
            <strong>{counts.followers}</strong>{" "}
            <span className="text-muted-foreground">{t("follow.followers")}</span>
          </Link>
          <Link to="/u/$fixedId/following" params={{ fixedId: profile.fixed_id }} className="hover:underline">
            <strong>{counts.following}</strong>{" "}
            <span className="text-muted-foreground">{t("follow.following")}</span>
          </Link>
        </div>
      </div>

      <div className="flex border-b border-border mt-4">
        {(["posts", "gallery"] as const).map((k) => (
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
        <ul className="mt-0">
          {posts.map((p) => (
            <PostCard key={`${p.id}-${p.repostedBy ? "r" : "o"}`} post={p} me={me} onDeleted={load} />
          ))}
        </ul>
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
    </div>
  );
}
