export const HASHTAG_RE = /#([\p{L}0-9_]{1,40})/gu;

export function extractHashtags(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) set.add(m[1].toLowerCase());
  return [...set];
}

/** Returns array of plain strings and { tag } objects for rendering links. */
export function tokenizeHashtags(text: string): Array<string | { tag: string }> {
  const out: Array<string | { tag: string }> = [];
  let last = 0;
  for (const m of text.matchAll(HASHTAG_RE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ tag: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
