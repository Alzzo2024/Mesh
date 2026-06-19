import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Send, Image as ImageIcon } from "lucide-react";
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
  created_at: string;
};

function ChatPage() {
  const { id } = Route.useParams();
  const { t } = useI18n();
  const [me, setMe] = useState<string | null>(null);
  const [conv, setConv] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
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
      .select("id, sender_id, content, media_url, media_type, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500);
    setMessages((msgs as Msg[]) ?? []);
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
    if (!text.trim() || !me) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: id, sender_id: me, content });
    if (error) toast.error(error.message);
  }

  async function uploadImage(file: File) {
    if (!me) return;
    const path = `${me}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("message-media").upload(path, file);
    if (error) return toast.error(error.message);
    await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: me,
      media_url: `message-media/${path}`,
      media_type: "image",
    });
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
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-foreground rounded-bl-sm"
                }`}
              >
                {conv?.type === "group" && !mine && (
                  <div className="text-xs opacity-70 mb-0.5">{prof?.nickname}</div>
                )}
                {m.media_type === "image" && m.media_url && <MediaImg path={m.media_url} />}
                {m.content && <div className="whitespace-pre-wrap break-words">{m.content}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-20 bg-background border-t border-border p-2 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
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
          className="rounded-full bg-primary text-primary-foreground p-2.5"
          aria-label="send"
        >
          <Send className="h-5 w-5" />
        </button>
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
