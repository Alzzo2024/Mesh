import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Send, Image as ImageIcon, X, Reply, MoreVertical, Trash2, UserPlus, Search } from "lucide-react";
import { resolveSignedUrl } from "@/components/SignedImage";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ImageLightbox } from "@/components/ImageLightbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/conversations/$id")({
  head: () => ({ meta: [{ title: "Mesh — Conversa" }] }),
  component: ChatPage,
});

type Msg = {
  id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to: string | null;
  created_at: string;
};

type MessageReaction = { message_id: string; user_id: string; emoji: string };

function groupReactions(rows: MessageReaction[]) {
  return rows.reduce<Record<string, MessageReaction[]>>((acc, row) => {
    acc[row.message_id] = [...(acc[row.message_id] ?? []), row];
    return acc;
  }, {});
}

function countEmojis(rows: MessageReaction[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.emoji] = (acc[row.emoji] ?? 0) + 1;
    return acc;
  }, {});
}

function ChatPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [conv, setConv] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [activeMsg, setActiveMsg] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data: c } = await supabase
      .from("conversations").select("id, type, name").eq("id", id).single();
    setConv(c);

    const { data: members } = await supabase
      .from("conversation_members").select("user_id").eq("conversation_id", id);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profs } = await supabase
      .from("profiles").select("id, nickname, fixed_id, avatar_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const pmap: Record<string, any> = {};
    (profs ?? []).forEach((p) => (pmap[p.id] = p));
    setProfiles(pmap);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, sender_id, content, media_url, media_type, reply_to, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500);
    setMessages((msgs as Msg[]) ?? []);

    const messageIds = (msgs ?? []).map((m) => m.id);
    const { data: rs } = await supabase
      .from("message_reactions").select("message_id, user_id, emoji")
      .in("message_id", messageIds.length ? messageIds : ["00000000-0000-0000-0000-000000000000"]);
    setReactions(groupReactions((rs as MessageReaction[]) ?? []));

    await supabase.rpc("mark_conversation_read", { _conv: id });
  }

  async function loadFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: fr } = await supabase
      .from("friendships").select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const friendIds = (fr ?? [])
      .filter((f) => f.status === "accepted")
      .map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
    const memberIds = Object.keys(profiles);
    const candidates = friendIds.filter((x) => !memberIds.includes(x));
    if (!candidates.length) { setFriends([]); return; }
    const { data: fp } = await supabase
      .from("profiles").select("id, nickname, fixed_id, avatar_url").in("id", candidates);
    setFriends(fp ?? []);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`chat:${id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as Msg]);
          supabase.rpc("mark_conversation_read", { _conv: id });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const didInitialScroll = useRef(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = didInitialScroll.current ? "smooth" : "auto";
    el.scrollTo({ top: el.scrollHeight, behavior });
    if (messages.length > 0) didInitialScroll.current = true;
  }, [messages]);

  async function send() {
    if ((!text.trim() && !selectedFile) || !me) return;
    const content = text.trim();
    setText("");
    let media_url: string | null = null;
    let media_type: "image" | null = null;
    if (selectedFile) {
      const path = `${me}/${Date.now()}-${selectedFile.name}`;
      const { error } = await supabase.storage.from("message-media").upload(path, selectedFile);
      if (error) return toast.error(error.message);
      media_url = `message-media/${path}`;
      media_type = "image";
    }
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: me, content, media_url, media_type, reply_to: replyTo?.id ?? null });
    if (error) toast.error(error.message);
    clearSelectedImage();
    setReplyTo(null);
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    clearSelectedImage();
    setSelectedFile(file);
    setSelectedPreview(URL.createObjectURL(file));
  }

  function clearSelectedImage() {
    if (selectedPreview) URL.revokeObjectURL(selectedPreview);
    setSelectedFile(null);
    setSelectedPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
    if (!item) return;
    const f = item.getAsFile();
    if (f) chooseImage(f);
  }

  async function reactToMessage(messageId: string, emoji: string) {
    if (!me) return;
    const { error } = await supabase
      .from("message_reactions")
      .upsert({ message_id: messageId, user_id: me, emoji }, { onConflict: "message_id,user_id" });
    if (error) return toast.error(error.message);
    setActiveMsg(null);
    load();
  }

  async function deleteChat() {
    if (!confirm(t("chats.deleteConfirm"))) return;
    const { error } = await supabase.rpc("delete_conversation", { _conv: id });
    if (error) return toast.error(error.message);
    navigate({ to: "/conversations" });
  }

  async function addMember(uid: string) {
    const { error } = await supabase.rpc("add_group_member", { _conv: id, _user: uid });
    if (error) return toast.error(error.message);
    setAddOpen(false);
    load();
  }

  const title =
    conv?.type === "direct"
      ? Object.values(profiles).find((p: any) => p.id !== me)?.nickname ?? ""
      : conv?.name ?? "";

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden pb-16 md:pb-0">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/conversations" className="p-2 -ml-1 rounded-full hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1 truncate">{title}</h1>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-2 rounded-full hover:bg-secondary" aria-label="menu">
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 min-w-44 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
              {conv?.type === "group" && (
                <button
                  onClick={() => { setMenuOpen(false); setAddOpen(true); loadFriends(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
                >
                  <UserPlus className="h-4 w-4" /> {t("chats.addMember")}
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); deleteChat(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary"
              >
                <Trash2 className="h-4 w-4" /> {t("chats.delete")}
              </button>
            </div>
          )}
        </div>
      </header>

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-3" onClick={() => setAddOpen(false)}>
          <div className="w-full md:max-w-sm rounded-2xl bg-popover border border-border p-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">{t("chats.addMember")}</h3>
            {friends.length === 0 && <p className="text-sm text-muted-foreground p-2">—</p>}
            <ul className="max-h-72 overflow-y-auto">
              {friends.map((f) => (
                <li key={f.id}>
                  <button onClick={() => addMember(f.id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary text-left">
                    <Avatar url={f.avatar_url} name={f.nickname} size={32} />
                    <span className="flex-1">{f.nickname}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-2">
        {messages.map((m) => {
          const mine = m.sender_id === me;
          const prof = profiles[m.sender_id];
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine && <Avatar url={prof?.avatar_url} name={prof?.nickname} size={28} />}
              <div className="relative max-w-[75%]">
                <button
                  type="button"
                  onClick={() => setActiveMsg((v) => (v === m.id ? null : m.id))}
                  className={`w-full rounded-2xl px-3.5 py-2 text-left ${
                    mine ? "bg-primary text-[#1a1a1a] rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                  }`}
                >
                  {conv?.type === "group" && !mine && (
                    <div className="text-xs opacity-70 mb-0.5">{prof?.nickname}</div>
                  )}
                  {m.reply_to && <ReplyPreview message={messages.find((x) => x.id === m.reply_to)} profiles={profiles} mine={mine} />}
                  {m.media_type === "image" && m.media_url && <MediaImg path={m.media_url} onOpen={setLightbox} />}
                  {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
                </button>
                {(reactions[m.id]?.length ?? 0) > 0 && (
                  <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                    {Object.entries(countEmojis(reactions[m.id])).map(([emoji, count]) => (
                      <span key={emoji} className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs">
                        {emoji} {count}
                      </span>
                    ))}
                  </div>
                )}
                {activeMsg === m.id && (
                  <div className={`absolute top-full z-20 mt-1 flex gap-1 rounded-full border border-border bg-popover p-1 shadow-xl ${mine ? "right-0" : "left-0"}`}>
                    {["💚","😂","❤️","🔥","👍","😢"].map((emoji) => (
                      <button key={emoji} onClick={() => reactToMessage(m.id, emoji)} className="rounded-full px-2 py-1 hover:bg-secondary" aria-label={t("chat.react")}>
                        {emoji}
                      </button>
                    ))}
                    <button onClick={() => { setReplyTo(m); setActiveMsg(null); }} className="rounded-full p-1.5 hover:bg-secondary" aria-label={t("chat.reply")}>
                      <Reply className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <div className="border-t border-border bg-background p-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {(replyTo || selectedPreview) && (
          <div className="mb-2 rounded-xl border border-border bg-secondary/60 p-2 text-sm">
            {replyTo && (
              <div className="mb-1 flex items-center justify-between gap-2 text-muted-foreground">
                <span>{t("chat.replyingTo")}: {profiles[replyTo.sender_id]?.nickname ?? t("common.you")}</span>
                <button onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></button>
              </div>
            )}
            {selectedPreview && (
              <div className="relative inline-block">
                <img src={selectedPreview} alt="" className="max-h-28 rounded-lg" />
                <button onClick={clearSelectedImage} className="absolute right-1 top-1 rounded-full bg-background/80 p-1">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => chooseImage(e.target.files?.[0])}
          />
          <button onClick={() => fileRef.current?.click()} className="p-2 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </button>
          <EmojiPicker onPick={(e) => setText((t) => t + e)} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={t("chat.placeholder")}
            className="flex-1 bg-input border border-border rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={send} className="rounded-full bg-primary text-[#1a1a1a] p-2.5" aria-label="send">
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaImg({ path, onOpen }: { path: string; onOpen: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveSignedUrl(path).then((signedUrl) => alive && setUrl(signedUrl));
    return () => { alive = false; };
  }, [path]);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="rounded-lg max-w-full mb-1 cursor-zoom-in"
      onClick={(e) => { e.stopPropagation(); onOpen(url); }}
    />
  );
}

function ReplyPreview({ message, profiles, mine }: { message?: Msg; profiles: Record<string, any>; mine: boolean }) {
  if (!message) return null;
  return (
    <div className={`mb-1 rounded-lg border-l-2 px-2 py-1 text-xs ${mine ? "border-background/50 bg-background/10" : "border-primary bg-background/20"}`}>
      <div className="font-medium opacity-80">{profiles[message.sender_id]?.nickname ?? "Mesh"}</div>
      <div className="line-clamp-2 opacity-70">{message.content || "📷"}</div>
    </div>
  );
}
