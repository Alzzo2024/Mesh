import { supabase } from "@/integrations/supabase/client";

/** Matches @nickname (letters, digits, _ and . — 2-20 chars). */
const MENTION_RE = /(^|[^@\w])@([A-Za-z0-9_.]{2,20})/g;

export function extractMentionNicknames(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) set.add(m[2]);
  return [...set];
}

/**
 * Resolves @nickname → #FIXED_ID in the given text, and returns:
 * - rewritten content
 * - mentioned user ids (for notifications)
 */
export async function resolveMentions(
  text: string,
): Promise<{ content: string; userIds: string[] }> {
  const nicks = extractMentionNicknames(text);
  if (nicks.length === 0) return { content: text, userIds: [] };

  const { data } = await supabase
    .from("profiles")
    .select("id, nickname, fixed_id")
    .in("nickname", nicks);

  if (!data?.length) return { content: text, userIds: [] };

  const map = new Map(data.map((p) => [p.nickname.toLowerCase(), p]));
  const content = text.replace(MENTION_RE, (full, pre: string, nick: string) => {
    const p = map.get(nick.toLowerCase());
    return p ? `${pre}#${p.fixed_id}` : full;
  });
  return { content, userIds: data.map((p) => p.id) };
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
