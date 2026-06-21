import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const PROFILE_SAFE_SELECT =
  "id, fixed_id, nickname, bio, avatar_url, banner_url, last_nickname_update, is_private, language, created_at, onboarded_at";

function makeFixedId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export async function ensureMyProfile(user: User) {
  const { data: existing } = await supabase
    .from("profiles")
    .select(PROFILE_SAFE_SELECT)
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return existing;

  const nickname =
    (user.user_metadata?.nickname as string | undefined)?.trim() || user.email?.split("@")[0] || "Mesh";

  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: user.id, fixed_id: makeFixedId(), nickname })
      .select(PROFILE_SAFE_SELECT)
      .single();
    if (!error && data) return data;
    if (!error?.message?.toLowerCase().includes("duplicate")) throw error;
  }

  throw new Error("Não foi possível criar o perfil.");
}