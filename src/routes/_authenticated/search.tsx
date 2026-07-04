import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { PostCard, hydratePosts, type FeedPost } from "@/components/PostCard";
import { SideBlocks } from "@/components/SideBlocks";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Mesh — Pesquisar" }] }),
  component: SearchPage,
});

type ProfileRow = {
  id: string;
  fixed_id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
};

function SearchPage() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"people" | "posts">("people");
  const [me, setMe] = useState<string | null>(null);
  const [people, setPeople] = useState<ProfileRow[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term || !me) {
      setPeople([]);
      setPosts([]);
      return;
    }
    const tagSearch = term.startsWith("#");
    const id = setTimeout(async () => {
      if (tab === "people") {
        const t2 = term.replace(/^[#@]/, "");
        const { data } = await supabase
          .from("profiles")
          .select("id, fixed_id, nickname, avatar_url, bio")
          .or(`nickname.ilike.%${t2}%,fixed_id.ilike.%${t2}%`)
          .limit(30);
        setPeople(data ?? []);
      } else {
        let raw;
        if (tagSearch) {
          const tag = term.slice(1).toLowerCase();
          raw = await supabase
            .from("posts")
            .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
            .contains("hashtags", [tag])
            .order("created_at", { ascending: false })
            .limit(50);
        } else {
          raw = await supabase
            .from("posts")
            .select("id, user_id, content, created_at, image_path, hashtags, pinned_at")
            .ilike("content", `%${term}%`)
            .order("created_at", { ascending: false })
            .limit(50);
        }
        if (raw.data?.length) setPosts(await hydratePosts(raw.data as any, me));
        else setPosts([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [q, tab, me]);

  async function react(post: FeedPost, reaction: "like" | "dislike") {
    if (!me) return;
    if (post.myReaction === reaction) {
      await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("user_id", me);
    } else {
      await supabase
        .from("post_reactions")
        .upsert({ post_id: post.id, user_id: me, reaction }, { onConflict: "post_id,user_id" });
    }
    // trigger refetch
    setQ((s) => s);
  }

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-3 space-y-2">
        <div className="flex items-center gap-2 bg-input border border-border rounded-full px-4 py-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent focus:outline-none text-sm"
          />
        </div>
        <div className="flex">
          {(["people", "posts"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 text-sm font-medium ${
                tab === k ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
              }`}
            >
              {t(`search.${k}`)}
            </button>
          ))}
        </div>
      </header>

      {!q.trim() && (
        <>
          <p className="px-8 pt-8 pb-4 text-center text-muted-foreground">{t("search.start")}</p>
          <div className="md:hidden px-4 pb-6">
            <SideBlocks />
          </div>
        </>
      )}

      {tab === "people" && q.trim() && (
        <ul>
          {people.length === 0 && (
            <li className="p-8 text-center text-muted-foreground">{t("search.empty")}</li>
          )}
          {people.map((p) => (
            <li key={p.id} className="border-b border-border">
              <Link
                to="/u/$fixedId"
                params={{ fixedId: p.fixed_id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40"
              >
                <Avatar url={p.avatar_url} name={p.nickname} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.nickname}</p>
                  <p className="text-xs text-muted-foreground">@{p.fixed_id}</p>
                  {p.bio && <p className="text-sm text-muted-foreground truncate">{p.bio}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {tab === "posts" && q.trim() && (
        <ul>
          {posts.length === 0 && (
            <li className="p-8 text-center text-muted-foreground">{t("search.empty")}</li>
          )}
          {posts.map((p) => (
            <PostCard key={p.id} post={p} me={me} onReact={react} onDeleted={() => setQ((s) => s)} />
          ))}
        </ul>
      )}
    </div>
  );
}
