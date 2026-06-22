import { useRef, useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { EmojiPicker } from "@/components/EmojiPicker";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { extractHashtags } from "@/lib/hashtags";
import { toast } from "sonner";

export function PostComposer({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearFile() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  async function submit() {
    const content = text.trim();
    if (!content && !file) return;
    setPosting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authed");

      let image_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        const key = `${user.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("post-media").upload(key, file);
        if (up.error) throw up.error;
        image_path = `post-media/${key}`;
      }

      const hashtags = extractHashtags(content);
      const { error } = await supabase
        .from("posts")
        .insert({ user_id: user.id, content, image_path, hashtags });
      if (error) throw error;

      setText("");
      clearFile();
      onPosted?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? t("error.generic"));
    } finally {
      setPosting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">{t("feed.newPost")}</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("feed.placeholder")}
          maxLength={500}
          rows={4}
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none focus:outline-none"
        />
        {preview && (
          <div className="relative mt-2">
            <img src={preview} alt="" className="w-full rounded-xl max-h-80 object-cover" />
            <button
              onClick={clearFile}
              className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5"
              aria-label={t("feed.removeImage")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded-full hover:bg-secondary text-primary"
              aria-label={t("feed.addImage")}
            >
              <ImageIcon className="h-5 w-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <EmojiPicker onPick={(e) => setText((t) => t + e)} />
            <span className="text-xs text-muted-foreground">{text.length}/500</span>
          </div>
          <button
            onClick={submit}
            disabled={posting || (!text.trim() && !file)}
            className="rounded-full bg-primary text-[#1a1a1a] text-sm font-medium px-5 py-2 disabled:opacity-40"
          >
            {t("feed.post")}
          </button>
        </div>
      </div>
    </div>
  );
}
