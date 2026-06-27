// Pure (no I/O) dictionary matcher shared by ingredient and tag extraction, so
// it can be unit-tested and reused. Given some text and a vocabulary of known
// names, it returns the names that appear in the text as whole words/phrases.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Return the subset of `vocabulary` that appears in `text` as whole words or
 * phrases — case-insensitive and plural-tolerant ("tomato" matches "tomatoes").
 * Longer phrases win over shorter ones at the same position, so "olive oil"
 * suppresses a spurious "oil" from the same span while a standalone "oil"
 * elsewhere still matches. Matched entries are returned in their original
 * vocabulary casing, ordered longest-first.
 *
 * Implementation: one combined, longest-first alternation regex scanned over
 * the text a single time (O(textLength), one compile), plus a lowercase→
 * canonical map to recover the original casing.
 */
export function matchEntities(text: string, vocabulary: string[]): string[] {
  if (!text.trim() || vocabulary.length === 0) return [];

  // lowercase key -> canonical casing (first occurrence wins).
  const canonical = new Map<string, string>();
  for (const term of vocabulary) {
    const key = term.toLowerCase();
    if (key && !canonical.has(key)) canonical.set(key, term);
  }

  // Longest-first so the regex prefers the longest phrase at each position
  // (JS alternation is ordered) and the output order is stable.
  const termsByLengthDesc = [...canonical.keys()].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );

  // \b(term1|term2|…)(?:e?s)?\b — capture group 1 is the matched term (without
  // any plural suffix), which is exactly one of the lowercased keys.
  const alternation = termsByLengthDesc.map(escapeRegex).join("|");
  const regex = new RegExp(`\\b(${alternation})(?:e?s)?\\b`, "g");

  // Collapse whitespace (incl. newlines) so multi-word phrases still match.
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const found = new Set<string>();
  for (const m of normalized.matchAll(regex)) found.add(m[1]);

  return termsByLengthDesc
    .filter((key) => found.has(key))
    .map((key) => canonical.get(key)!);
}
