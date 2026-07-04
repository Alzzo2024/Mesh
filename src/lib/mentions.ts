import { supabase } from "@/integrations/supabase/client";

/** Matches public Mesh IDs: @ABC123 (letters/digits, max 10 chars). */
const MENTION_RE = /(^|[^@\w])@([A-Za-z0-9]{1,10})\b/g;

export function extractMentionNicknames(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) set.add(m[2]);
  return [...set];
}

/**
 * Resolves @FIXED_ID mentions only, and returns:
 * - rewritten content normalized to @FIXED_ID
 * - mentioned user ids (for notifications)
 */
export async function resolveMentions(
  text: string,
): Promise<{ content: string; userIds: string[] }> {
  const tokens = extractMentionNicknames(text);
  if (tokens.length === 0) return { content: text, userIds: [] };

  const ids = [...new Set(tokens.map((t) => t.toUpperCase()))];
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, fixed_id")
    .in("fixed_id", ids);
  if (!profs.length) return { content: text, userIds: [] };

  const idMap = new Map(profs.map((p) => [p.fixed_id.toUpperCase(), p]));

  const userIds = new Set<string>();
  const content = text.replace(MENTION_RE, (full, pre: string, token: string) => {
    const byFixedId = idMap.get(token.toUpperCase());
    const p = byFixedId;
    if (!p) return full;
    userIds.add(p.id);
    return `${pre}@${p.fixed_id}`;
  });
  return { content, userIds: [...userIds] };
}

export async function insertMentionNotifications(
  actorId: string,
  postId: string,
  userIds: string[],
) {
  const rows = userIds
    .filter((uid) => uid !== actorId)
    .map((uid) => ({ user_id: uid, actor_id: actorId, type: "mention" as const, post_id: postId }));
  if (rows.length === 0) return;
  await supabase.from("notifications").insert(rows);
}
