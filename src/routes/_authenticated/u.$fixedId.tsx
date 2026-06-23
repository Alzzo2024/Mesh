import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { SignedImage } from "@/components/SignedImage";
import { FollowButton } from "@/components/FollowButton";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";
import { CreatorBadge } from "@/components/CreatorBadge";
import { TrustBadge } from "@/components/TrustBadge";
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

    const [{ data: ps }, fol, fwg] = await Promise.all([
      supabase
        .from("posts")
        .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
        .eq("user_id", p.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
    ]);
    setCounts({ followers: fol.count ?? 0, following: fwg.count ?? 0 });
    if (ps?.length && user) setPosts(await hydratePosts(ps as any, user.id));
    else setPosts([]);
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

  if (path !== `/u/${fixedId}`) return <Outlet />;

  if (!profile) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;

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
            <p className="text-sm text-muted-foreground font-mono">#{profile.fixed_id}</p>
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

      <ul className="mt-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} onReact={react} onDeleted={load} />
        ))}
      </ul>
    </div>
  );
}
