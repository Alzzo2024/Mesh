import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { Settings, Camera } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mesh — Perfil" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [bannerSigned, setBannerSigned] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);
    if (p?.banner_url) {
      const slash = p.banner_url.indexOf("/");
      const { data } = await supabase.storage
        .from(p.banner_url.slice(0, slash))
        .createSignedUrl(p.banner_url.slice(slash + 1), 3600);
      setBannerSigned(data?.signedUrl ?? null);
    } else setBannerSigned(null);

    const { data: ps } = await supabase
      .from("posts")
      .select("id, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPosts(ps ?? []);
    const { data: cs } = await supabase
      .from("comments")
      .select("id, content, created_at, post_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setComments(cs ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload(bucket: "avatars" | "banners", file: File) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const col = bucket === "avatars" ? "avatar_url" : "banner_url";
    await supabase.from("profiles").update({ [col]: `${bucket}/${path}` }).eq("id", user.id);
    load();
  }

  if (!profile) return <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div>
      <div className="relative h-40 bg-secondary">
        {bannerSigned && (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img src={bannerSigned} className="w-full h-full object-cover" />
        )}
        <button
          onClick={() => bannerRef.current?.click()}
          className="absolute top-3 right-3 rounded-full bg-background/80 p-2"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input
          ref={bannerRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload("banners", e.target.files[0])}
        />
        <Link
          to="/profile/settings"
          className="absolute top-3 left-3 rounded-full bg-background/80 p-2"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      <div className="px-4 -mt-10 relative">
        <div className="relative w-20 h-20">
          <Avatar url={profile.avatar_url} name={profile.nickname} size={80} className="ring-4 ring-background" />
          <button
            onClick={() => avatarRef.current?.click()}
            className="absolute bottom-0 right-0 rounded-full bg-primary text-primary-foreground p-1.5"
          >
            <Camera className="h-3 w-3" />
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload("avatars", e.target.files[0])}
          />
        </div>
        <h1 className="text-xl font-bold mt-3">{profile.nickname}</h1>
        <p className="text-sm text-muted-foreground font-mono">#{profile.fixed_id}</p>
        {profile.bio && <p className="text-sm mt-2 whitespace-pre-wrap">{profile.bio}</p>}
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

      <ul>
        {(tab === "posts" ? posts : comments).map((item) => (
          <li key={item.id} className="px-4 py-3 border-b border-border">
            <p className="text-sm whitespace-pre-wrap">{item.content}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(item.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
