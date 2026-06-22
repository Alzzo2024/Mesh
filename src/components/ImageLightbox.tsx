import { useEffect } from "react";
import { X } from "lucide-react";

export function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-3 right-3 rounded-full bg-background/20 p-2 text-white"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </button>
      <img src={src} alt="" className="max-h-full max-w-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
