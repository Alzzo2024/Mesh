import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, MessageCircle, Heart, ThumbsDown, UserPlus, AtSign, Repeat2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Mesh — Notificações" }] }),
  component: NotificationsPage,
});

type N = {
  id: string;
  type: "comment" | "like" | "dislike" | "follow" | "mention" | "repost";
  actor_id: string | null;
  post_id: string | null;
  created_at: string;
  read_at: string | null;
  actor?: { nickname: string; fixed_id: string; avatar_url: string | null };
};

function NotificationsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<N[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, actor_id, post_id, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as N[];
    const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[])];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, nickname, fixed_id, avatar_url").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      rows.forEach((r) => { if (r.actor_id) r.actor = map.get(r.actor_id) as any; });
    }
    setItems(rows);
    setLoaded(true);

    // Mark unread as read
    const unread = rows.filter((r) => !r.read_at).map((r) => r.id);
    if (unread.length) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
    }
  }

  useEffect(() => { load(); }, []);

  function label(n: N) {
    if (n.type === "comment") return t("notifs.comment");
    if (n.type === "like") return t("notifs.like");
    if (n.type === "dislike") return t("notifs.dislike");
    if (n.type === "mention") return t("notifs.mention");
    if (n.type === "repost") return t("notifs.repost");
    return t("notifs.follow");
  }

  function icon(n: N) {
    if (n.type === "comment") return <MessageCircle className="h-4 w-4 text-primary" />;
    if (n.type === "like") return <Heart className="h-4 w-4 text-primary" />;
    if (n.type === "dislike") return <ThumbsDown className="h-4 w-4 text-destructive" />;
    if (n.type === "mention") return <AtSign className="h-4 w-4 text-primary" />;
    if (n.type === "repost") return <Repeat2 className="h-4 w-4 text-primary" />;
    return <UserPlus className="h-4 w-4 text-primary" />;
  }

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
        <Bell className="h-5 w-5" />
        <h1 className="text-xl font-semibold">{t("notifs.title")}</h1>
      </header>

      {loaded && items.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t("notifs.empty")}</p>
      )}

      <ul>
        {items.map((n) => {
          const inner = (
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-secondary/40">
              <Avatar url={n.actor?.avatar_url} name={n.actor?.nickname} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{n.actor?.nickname ?? "?"}</span>{" "}
                  <span className="text-muted-foreground">{label(n)}</span>
                </p>
                <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {icon(n)}
            </div>
          );
          if (n.post_id) {
            return <li key={n.id}><Link to="/post/$id" params={{ id: n.post_id }}>{inner}</Link></li>;
          }
          if (n.actor?.fixed_id) {
            return <li key={n.id}><Link to="/u/$fixedId" params={{ fixedId: n.actor.fixed_id }}>{inner}</Link></li>;
          }
          return <li key={n.id}>{inner}</li>;
        })}
      </ul>
    </div>
  );
}
