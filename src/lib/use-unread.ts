import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UnreadCtx = { messages: number; notifications: number };

export function useUnreadCounts(): UnreadCtx {
  const [counts, setCounts] = useState<UnreadCtx>({ messages: 0, notifications: 0 });

  useEffect(() => {
    let alive = true;
    let me: string | null = null;

    async function refresh() {
      if (!me) return;
      const [msgRes, notifRes] = await Promise.all([
        supabase
          .from("conversation_members")
          .select("conversation_id, last_read_at")
          .eq("user_id", me),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", me)
          .is("read_at", null),
      ]);

      const members = msgRes.data ?? [];
      let msgUnread = 0;
      if (members.length) {
        const convIds = members.map((m) => m.conversation_id);
        const { data: msgs } = await supabase
          .from("messages")
          .select("conversation_id, sender_id, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false })
          .limit(200);
        const lastByConv = new Map(members.map((m) => [m.conversation_id, m.last_read_at]));
        const seen = new Set<string>();
        for (const m of msgs ?? []) {
          if (m.sender_id === me) continue;
          if (seen.has(m.conversation_id)) continue;
          const lr = lastByConv.get(m.conversation_id);
          if (lr && new Date(m.created_at) > new Date(lr)) {
            msgUnread += 1;
            seen.add(m.conversation_id);
          }
        }
      }

      if (!alive) return;
      setCounts({ messages: msgUnread, notifications: notifRes.count ?? 0 });
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !alive) return;
      me = user.id;
      await refresh();

      const ch = supabase
        .channel(`unread:${me}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me}` }, refresh)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `user_id=eq.${me}` }, refresh)
        .subscribe();

      return () => supabase.removeChannel(ch);
    })();

    return () => { alive = false; };
  }, []);

  return counts;
}
