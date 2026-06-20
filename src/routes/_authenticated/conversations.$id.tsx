import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Send, Image as ImageIcon, X, Reply, Smile } from "lucide-react";
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

function ChatPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data: c } = await supabase
      .from("conversations")
      .select("id, type, name")
      .eq("id", id)
      .single();
    setConv(c);

    const { data: members } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", id);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nickname, fixed_id, avatar_url")
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
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", messageIds.length ? messageIds : ["00000000-0000-0000-0000-000000000000"]);
    setReactions(groupReactions((rs as MessageReaction[]) ?? []));
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as Msg]);
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
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

  async function reactToMessage(messageId: string, emoji: string) {
    if (!me) return;
    const { error } = await supabase
      .from("message_reactions")
      .upsert({ message_id: messageId, user_id: me, emoji }, { onConflict: "message_id,user_id" });
    if (error) return toast.error(error.message);
    setActiveMsg(null);
    load();
  }

  const title =
    conv?.type === "direct"
      ? Object.values(profiles).find((p: any) => p.id !== me)?.nickname ?? ""
      : conv?.name ?? "";

  return (
    <div className="flex flex-col h-[100dvh] pb-20">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-3 py-3 flex items-center gap-2">
        <Link to="/conversations" className="p-2 -ml-1 rounded-full hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-semibold flex-1 truncate">{title}</h1>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
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
                    mine
                      ? "bg-primary text-[#1a1a1a] rounded-br-sm"
                      : "bg-secondary text-foreground rounded-bl-sm"
                  }`}
                >
                  {conv?.type === "group" && !mine && (
                    <div className="text-xs opacity-70 mb-0.5">{prof?.nickname}</div>
                  )}
                  {m.reply_to && <ReplyPreview message={messages.find((x) => x.id === m.reply_to)} profiles={profiles} mine={mine} />}
                  {m.media_type === "image" && m.media_url && <MediaImg path={m.media_url} />}
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
                    {["💚", "😂", "🔥", "⭐"].map((emoji) => (
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

      <div className="sticky bottom-20 border-t border-border bg-background p-2">
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
        <div className="flex items-center gap-2">
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
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("chat.placeholder")}
          className="flex-1 bg-input border border-border rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={send}
          className="rounded-full bg-primary text-[#1a1a1a] p-2.5"
          aria-label="send"
        >
          <Send className="h-5 w-5" />
        </button>
        </div>
      </div>
    </div>
  );
}

function MediaImg({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const slash = path.indexOf("/");
    const bucket = path.slice(0, slash);
    const obj = path.slice(slash + 1);
    supabase.storage.from(bucket).createSignedUrl(obj, 3600).then(({ data }) => {
      setUrl(data?.signedUrl ?? null);
    });
  }, [path]);
  if (!url) return null;
  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={url} className="rounded-lg max-w-full mb-1" />;
}
