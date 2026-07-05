import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { FollowButton } from "@/components/FollowButton";

type Prof = { id: string; nickname: string; fixed_id: string; avatar_url: string | null };

export function TrendsBlock() {
  const { t } = useI18n();
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("hashtags")
        .not("hashtags", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        for (const raw of (row.hashtags as string[] | null) ?? []) {
          const tag = String(raw).toLowerCase();
          if (!tag) continue;
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
      setTags(
        [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag, count]) => ({ tag, count })),
      );
    })();
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-secondary/30 p-4">
      <h3 className="font-semibold mb-3">{t("side.trends")}</h3>
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("side.noTrends")}</p>
      ) : (
        <ul className="space-y-2">
          {tags.map((x) => (
            <li key={x.tag}>
              <Link
                to="/hashtag/$tag"
                params={{ tag: x.tag }}
                className="flex items-center justify-between hover:text-primary"
              >
                <span className="truncate">#{x.tag}</span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{x.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SuggestionsBlock({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useI18n();
  const [profs, setProfs] = useState<Prof[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setMe(user?.id ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, fixed_id, avatar_url")
        .limit(200);
      // Dedupe by id (defensive)
      const seen = new Set<string>();
      let list: Prof[] = [];
      for (const p of data ?? []) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        list.push(p as Prof);
      }
      list = list.filter((p) => p.id !== user?.id);
      if (user) {
        const { data: fol } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        const set = new Set((fol ?? []).map((x) => x.following_id));
        list = list.filter((p) => !set.has(p.id));
      }
      // Fisher-Yates shuffle
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      setProfs(list.slice(0, 5));
    })();
  }, [refreshKey]);

  if (!me) return null;

  return (
    <section className="rounded-2xl border border-border bg-secondary/30 p-4">
      <h3 className="font-semibold mb-3">{t("side.suggestions")}</h3>
      {profs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("side.noSuggestions")}</p>
      ) : (
        <ul className="space-y-3">
          {profs.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Link to="/u/$fixedId" params={{ fixedId: p.fixed_id }} className="shrink-0">
                <Avatar url={p.avatar_url} name={p.nickname} size={36} />
              </Link>
              <Link
                to="/u/$fixedId"
                params={{ fixedId: p.fixed_id }}
                className="flex-1 min-w-0"
              >
                <div className="truncate text-sm font-medium hover:underline">{p.nickname}</div>
                <div className="truncate text-xs text-muted-foreground">@{p.fixed_id}</div>
              </Link>
              <FollowButton targetUserId={p.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SideBlocks({ refreshKey }: { refreshKey?: number }) {
  return (
    <div className="space-y-4">
      <TrendsBlock />
      <SuggestionsBlock refreshKey={refreshKey} />
    </div>
  );
}
