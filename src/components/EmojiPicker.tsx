import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😀","😂","😅","😍","🥰","😘","😎","🤔","😢","😭","😡","🤬",
  "👍","👎","🙏","👏","🙌","💪","🤝","✌️","🤞","🤙",
  "❤️","💚","💙","💜","🖤","🤍","💔","🔥","⭐","🌟","✨",
  "🎉","🎊","🥳","🎂","🎁","☕","🍕","🍔","⚽","🏆","🎮","🎵","💯","✅","❌",
];

export function EmojiPicker({ onPick, align = "left" }: { onPick: (e: string) => void; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full hover:bg-secondary text-muted-foreground"
        aria-label="Emojis"
      >
        <Smile className="h-5 w-5" />
      </button>
      {open && (
        <div
          className={`absolute bottom-full mb-2 z-40 w-64 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-xl grid grid-cols-8 gap-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="text-xl rounded hover:bg-secondary p-1"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
