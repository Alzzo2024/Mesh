import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expiresAt: number }>();

async function resolveUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  // path format: "bucket/objectPath"
  const slash = path.indexOf("/");
  if (slash === -1) return null;
  const bucket = path.slice(0, slash);
  const obj = path.slice(slash + 1);
  const { data } = await supabase.storage.from(bucket).createSignedUrl(obj, 60 * 60 * 24);
  if (data?.signedUrl) {
    cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + 60 * 60 * 23 * 1000 });
    return data.signedUrl;
  }
  return null;
}

export function Avatar({
  url,
  name,
  size = 40,
  className = "",
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveUrl(url).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [url]);

  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden bg-secondary flex items-center justify-center text-foreground/80 font-medium ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={src} className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
