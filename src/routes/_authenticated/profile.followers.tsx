import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/profile/followers")({
  head: () => ({ meta: [{ title: "Mesh — Seguidores" }] }),
  component: FollowersPage,
});

function FollowersPage() {
  return <FollowList kind="followers" />;
}

export function FollowList({ kind, fixedId }: { kind: "followers" | "following"; fixedId?: string }) {
  const { t } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      let targetId = user.id;
      if (fixedId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("fixed_id", fixedId.toUpperCase())
          .maybeSingle();
        if (!profile) {
          setUsers([]);
          setLoading(false);
          return;
        }
        targetId = profile.id;
      }
      const col = kind === "followers" ? "following_id" : "follower_id";
      const otherCol = kind === "followers" ? "follower_id" : "following_id";
      const { data: rows } = await supabase.from("follows").select(otherCol).eq(col, targetId);
      const ids = (rows ?? []).map((r: any) => r[otherCol]);
      if (ids.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, fixed_id, nickname, avatar_url, bio")
        .in("id", ids);
      setUsers(profs ?? []);
      setLoading(false);
    })();
  }, [kind, fixedId]);

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link
          to={fixedId ? "/u/$fixedId" : "/profile"}
          params={fixedId ? { fixedId } : undefined}
          className="p-2 -ml-1 rounded-full hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold">{t(`follow.${kind}`)}</h1>
      </header>
      {loading ? (
        <p className="p-8 text-center text-muted-foreground">{t("common.loading")}</p>
      ) : users.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">
          {t(kind === "followers" ? "follow.noFollowers" : "follow.noFollowing")}
        </p>
      ) : (
        <ul>
          {users.map((u) => (
            <li key={u.id} className="border-b border-border">
              <Link
                to="/u/$fixedId"
                params={{ fixedId: u.fixed_id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40"
              >
                <Avatar url={u.avatar_url} name={u.nickname} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{u.nickname}</p>
                  <p className="text-xs text-muted-foreground">#{u.fixed_id}</p>
                  {u.bio && <p className="text-sm text-muted-foreground truncate">{u.bio}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
