import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { UserPlus, Users, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conversations")({
  head: () => ({ meta: [{ title: "Mesh — Conversas" }] }),
  component: ConvList,
});

type ConvRow = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  other?: { id: string; nickname: string; fixed_id: string; avatar_url: string | null };
  lastMessage?: string;
  lastAt?: string;
};

function ConvList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [me, setMe] = useState<string | null>(null);
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [addId, setAddId] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSel, setGroupSel] = useState<string[]>([]);

  async function refresh() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);
    const ids = memberships?.map((m) => m.conversation_id) ?? [];

    if (ids.length > 0) {
      const { data: cs } = await supabase
        .from("conversations")
        .select("id, type, name")
        .in("id", ids);
      const { data: allMembers } = await supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", ids);
      const otherIds = [
        ...new Set((allMembers ?? []).filter((m) => m.user_id !== user.id).map((m) => m.user_id)),
      ];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nickname, fixed_id, avatar_url")
        .in("id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
      const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false });
      const lastMap = new Map<string, any>();
      for (const m of lastMsgs ?? []) if (!lastMap.has(m.conversation_id)) lastMap.set(m.conversation_id, m);

      const rows: ConvRow[] = (cs ?? []).map((c) => {
        const others = (allMembers ?? []).filter(
          (m) => m.conversation_id === c.id && m.user_id !== user.id,
        );
        const lastMsg = lastMap.get(c.id);
        return {
          id: c.id,
          type: c.type as any,
          name: c.name,
          other: c.type === "direct" && others[0] ? (pmap.get(others[0].user_id) as any) : undefined,
          lastMessage: lastMsg?.content ?? "",
          lastAt: lastMsg?.created_at,
        };
      });
      rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
      setConvs(rows);
    } else {
      setConvs([]);
    }

    const { data: fr } = await supabase
      .from("friendships")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const friendIds = (fr ?? [])
      .filter((f) => f.status === "accepted")
      .map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
    const pendingIn = (fr ?? []).filter((f) => f.status === "pending" && f.addressee_id === user.id);
    const { data: friendProfiles } = await supabase
      .from("profiles")
      .select("id, nickname, fixed_id, avatar_url")
      .in("id", friendIds.length ? friendIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data: pendingProfiles } = await supabase
      .from("profiles")
      .select("id, nickname, fixed_id, avatar_url")
      .in(
        "id",
        pendingIn.length ? pendingIn.map((p) => p.requester_id) : ["00000000-0000-0000-0000-000000000000"],
      );
    setFriends(friendProfiles ?? []);
    setPending(
      pendingIn.map((p) => ({
        ...p,
        profile: (pendingProfiles ?? []).find((pr) => pr.id === p.requester_id),
      })),
    );
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("convs")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendFriendRequest() {
    if (!me) return;
    const code = addId.trim().toUpperCase();
    if (code.length !== 6) return toast.error("ID inválido");
    const { data: prof } = await supabase.from("profiles").select("id").eq("fixed_id", code).maybeSingle();
    if (!prof) return toast.error("Utilizador não encontrado");
    if (prof.id === me) return toast.error("Não te podes adicionar a ti próprio");
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: me, addressee_id: prof.id });
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado");
    setAddId("");
  }

  async function acceptFriend(f: any) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", f.id);
    refresh();
  }
  async function rejectFriend(f: any) {
    await supabase.from("friendships").delete().eq("id", f.id);
    refresh();
  }

  async function openDirect(otherId: string) {
    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
      _other_user: otherId,
    });
    if (error) return toast.error(error.message);
    navigate({ to: "/conversations/$id", params: { id: data as string } });
  }

  async function createGroup() {
    if (!me || !groupName.trim() || groupSel.length === 0) return;
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ type: "group", name: groupName.trim(), created_by: me })
      .select("id")
      .single();
    if (error || !conv) return toast.error(error?.message ?? "Erro");
    const members = [
      { conversation_id: conv.id, user_id: me, is_admin: true },
      ...groupSel.map((uid) => ({ conversation_id: conv.id, user_id: uid, is_admin: false })),
    ];
    await supabase.from("conversation_members").insert(members);
    setGroupOpen(false);
    setGroupName("");
    setGroupSel([]);
    navigate({ to: "/conversations/$id", params: { id: conv.id } });
  }

  if (path !== "/conversations") return <Outlet />;

  return (
    <div>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <h1 className="text-xl font-semibold">{t("chats.title")}</h1>
      </header>

      <section className="p-4 border-b border-border space-y-2">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("chats.addFriend")}
        </label>
        <div className="flex gap-2">
          <input
            value={addId}
            onChange={(e) => setAddId(e.target.value.toUpperCase())}
            placeholder={t("chats.fixedIdPlaceholder")}
            maxLength={6}
            className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={sendFriendRequest}
            className="rounded-xl bg-primary text-[#1a1a1a] px-4"
            aria-label="add"
          >
            <UserPlus className="h-5 w-5" />
          </button>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">{t("chats.requests")}</h2>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar url={p.profile?.avatar_url} name={p.profile?.nickname} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.profile?.nickname}</div>
                  <div className="text-xs text-muted-foreground">#{p.profile?.fixed_id}</div>
                </div>
                <button onClick={() => acceptFriend(p)} className="rounded-full bg-primary text-[#1a1a1a] p-2">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => rejectFriend(p)} className="rounded-full bg-secondary p-2">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{t("chats.friends")}</h2>
        <button
          onClick={() => setGroupOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-primary"
        >
          <Users className="h-4 w-4" /> {t("chats.newGroup")}
        </button>
      </section>

      {groupOpen && (
        <section className="p-4 border-b border-border space-y-3">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("chats.groupName")}
            className="w-full bg-input border border-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="space-y-1.5">
            {friends.map((f) => {
              const sel = groupSel.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() =>
                    setGroupSel((s) => (sel ? s.filter((x) => x !== f.id) : [...s, f.id]))
                  }
                  className={`w-full flex items-center gap-3 p-2 rounded-lg ${sel ? "bg-primary/10" : ""}`}
                >
                  <Avatar url={f.avatar_url} name={f.nickname} size={32} />
                  <span className="flex-1 text-left">{f.nickname}</span>
                  {sel && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <button
            onClick={createGroup}
            disabled={!groupName.trim() || groupSel.length === 0}
            className="w-full rounded-xl bg-primary text-[#1a1a1a] py-2.5 disabled:opacity-40"
          >
            {t("chats.create")}
          </button>
        </section>
      )}

      {convs.length === 0 && friends.length === 0 ? (
        <p className="text-center text-muted-foreground p-8 text-sm">{t("chats.noFriends")}</p>
      ) : (
        <ul>
          {convs.map((c) => (
            <li key={c.id}>
              <Link
                to="/conversations/$id"
                params={{ id: c.id }}
                className="flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-secondary/40"
              >
                <Avatar
                  url={c.type === "direct" ? c.other?.avatar_url : null}
                  name={c.type === "direct" ? c.other?.nickname : c.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {c.type === "direct" ? c.other?.nickname : c.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{c.lastMessage}</div>
                </div>
              </Link>
            </li>
          ))}
          {friends
            .filter((f) => !convs.some((c) => c.type === "direct" && c.other?.id === f.id))
            .map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => openDirect(f.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-secondary/40"
                >
                  <Avatar url={f.avatar_url} name={f.nickname} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-medium truncate">{f.nickname}</div>
                    <div className="text-xs text-muted-foreground">#{f.fixed_id}</div>
                  </div>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
