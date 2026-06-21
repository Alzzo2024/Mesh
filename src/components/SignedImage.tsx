import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expiresAt: number }>();

export async function resolveSignedUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
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

export function SignedImage({
  path,
  className,
  alt = "",
}: {
  path?: string | null;
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveSignedUrl(path).then((u) => alive && setSrc(u));
    return () => {
      alive = false;
    };
  }, [path]);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} />;
}
