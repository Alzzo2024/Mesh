import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { SignedImage } from "@/components/SignedImage";
import { CreatorBadge } from "@/components/CreatorBadge";
import { TrustBadge } from "@/components/TrustBadge";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mesh — Perfil" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [profile, setProfile] = useState<any>(null);
  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const [psRes, csRes, fol, fwg] = await Promise.all([
      supabase
        .from("posts")
        .select("id, user_id, content, created_at, image_path, hashtags")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("comments")
        .select("id, content, created_at, post_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
    ]);
    setPosts(psRes.data?.length ? await hydratePosts(psRes.data as any, user.id) : []);
    setComments(csRes.data ?? []);
    setCounts({ followers: fol.count ?? 0, following: fwg.count ?? 0 });
  }

  useEffect(() => {
    load();
  }, []);

  if (path !== "/profile") return <Outlet />;

  if (!profile) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;

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
      <div className="relative h-40 bg-secondary">
        {profile.banner_url && (
          <SignedImage path={profile.banner_url} className="w-full h-full object-cover" />
        )}
        <Link
          to="/profile/settings"
          className="absolute top-3 right-3 rounded-full bg-background/80 p-2 flex items-center gap-1.5 text-xs px-3"
          aria-label={t("profile.editAppearance")}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">{t("profile.editAppearance")}</span>
        </Link>
      </div>

      <div className="px-4 -mt-10 relative">
        <Avatar url={profile.avatar_url} name={profile.nickname} size={80} className="ring-4 ring-background" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{profile.nickname}</h1>
          <TrustBadge targetUserId={profile.id} interactive={false} />
          <CreatorBadge fixedId={profile.fixed_id} />
        </div>
        <p className="text-sm text-muted-foreground font-mono">#{profile.fixed_id}</p>
        {profile.bio && <p className="text-sm mt-2 whitespace-pre-wrap">{profile.bio}</p>}
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
        {(["posts", "comments"] as const).map((k) => (
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

      {tab === "posts" ? (
        <ul>{posts.map((p) => <PostCard key={p.id} post={p} me={me} onReact={react} onDeleted={load} />)}</ul>
      ) : (
        <ul>
          {comments.map((item) => (
            <li key={item.id} className="border-b border-border">
              <Link to="/post/$id" params={{ id: item.post_id }} className="block px-4 py-3 hover:bg-secondary/40">
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
