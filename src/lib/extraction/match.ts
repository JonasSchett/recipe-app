// Pure (no I/O) dictionary matcher shared by ingredient and tag extraction, so
// it can be unit-tested and reused. Given some text and a vocabulary of known
// names, it returns the names that appear in the text as whole words/phrases.

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match the whole term on word boundaries, tolerating an optional plural suffix
// on the end (handles the common singular-in-vocab / plural-in-text case:
// "tomato" matches "tomatoes"). The term is expected pre-lowercased.
function termRegex(lowerTerm: string, global: boolean): RegExp {
  return new RegExp(`\\b${escapeRegex(lowerTerm)}(?:e?s)?\\b`, global ? "g" : "");
}

/**
 * Return the subset of `vocabulary` that appears in `text` as whole words or
 * phrases — case-insensitive and plural-tolerant. Longer phrases are matched
 * first and their occurrences blanked out, so "olive oil" suppresses a spurious
 * "oil" from the same span while a standalone "oil" elsewhere still matches.
 * Matched entries are returned in their original vocabulary casing.
 */
export function matchEntities(text: string, vocabulary: string[]): string[] {
  if (!text.trim()) return [];

  // Pad with spaces so word boundaries at the very start/end behave, and
  // collapse all whitespace (incl. newlines) so multi-word phrases still match.
  let working = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;

  const byLengthDesc = [...vocabulary].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );

  const matched: string[] = [];
  const seen = new Set<string>();
  for (const term of byLengthDesc) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    if (termRegex(key, false).test(working)) {
      matched.push(term);
      seen.add(key);
      working = working.replace(termRegex(key, true), " ");
    }
  }
  return matched;
}
