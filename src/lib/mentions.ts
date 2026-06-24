import { supabase } from "@/integrations/supabase/client";

/** Matches @nickname (letters, digits, _ and . — 2-20 chars). */
const MENTION_RE = /(^|[^@\w])@([A-Za-z0-9_.]{2,20})/g;

export function extractMentionNicknames(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) set.add(m[2]);
  return [...set];
}

/**
 * Resolves @nickname → @FIXED_ID in the given text, and returns:
 * - rewritten content (preserves @FIXED_ID as-is if already an id)
 * - mentioned user ids (for notifications)
 */
export async function resolveMentions(
  text: string,
): Promise<{ content: string; userIds: string[] }> {
  const tokens = extractMentionNicknames(text);
  if (tokens.length === 0) return { content: text, userIds: [] };

  // Try both nickname and fixed_id matches
  const [byNick, byId] = await Promise.all([
    supabase.from("profiles").select("id, nickname, fixed_id").in("nickname", tokens),
    supabase.from("profiles").select("id, nickname, fixed_id").in("fixed_id", tokens.map((t) => t.toUpperCase())),
  ]);

  const profs = [...(byNick.data ?? []), ...(byId.data ?? [])];
  if (!profs.length) return { content: text, userIds: [] };

  const nickMap = new Map(profs.map((p) => [p.nickname.toLowerCase(), p]));
  const idMap = new Map(profs.map((p) => [p.fixed_id.toUpperCase(), p]));

  const userIds = new Set<string>();
  const content = text.replace(MENTION_RE, (full, pre: string, token: string) => {
    const byNickname = nickMap.get(token.toLowerCase());
    const byFixedId = idMap.get(token.toUpperCase());
    const p = byNickname ?? byFixedId;
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
