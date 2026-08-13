const MAX_TAG_LENGTH = 40;
const MAX_TAGS_PER_ITEM = 20;

/**
 * Trims, drops blanks, caps length, and de-dupes case-insensitively while
 * keeping the first-typed casing — "Vegan" then "vegan" stays "Vegan".
 */
export function normalizeTagNames(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of raw) {
    const name = value.trim().slice(0, MAX_TAG_LENGTH);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);

    if (result.length >= MAX_TAGS_PER_ITEM) break;
  }

  return result;
}
