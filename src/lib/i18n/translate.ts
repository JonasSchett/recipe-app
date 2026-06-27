import {
  INGREDIENT_TRANSLATIONS,
  TAG_TRANSLATIONS,
  type Translation,
} from "@/lib/i18n/dictionary";

export type Domain = "ingredient" | "tag";
export type Locale = "en" | "de";

/** Lowercased, trimmed, whitespace-collapsed lookup key. */
export function normalizeTerm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

// Light English plural strip, mirroring the extraction matcher's tolerance, so
// "onions" still resolves to "Onion". (German plurals aren't handled yet — a
// known limitation; they fall through to the external provider or create a new
// entity until their singular alias exists.)
function singularize(s: string): string {
  return s.replace(/(?:es|s)$/i, "");
}

function buildIndex(dict: Translation[]): Map<string, Translation> {
  const index = new Map<string, Translation>();
  for (const t of dict) {
    for (const key of [normalizeTerm(t.en), normalizeTerm(t.de)]) {
      if (!index.has(key)) index.set(key, t);
    }
  }
  return index;
}

const INDEXES: Record<Domain, Map<string, Translation>> = {
  ingredient: buildIndex(INGREDIENT_TRANSLATIONS),
  tag: buildIndex(TAG_TRANSLATIONS),
};

/**
 * Resolve a term (in any supported language) to its `{ en, de }` translation
 * via the curated dictionary, with a light plural fallback. Returns null when
 * the term is unknown — the caller then treats the input as its own canonical.
 * (Hook point for an optional external provider; see DEFERRED in the feature.)
 */
export function translateTerm(domain: Domain, term: string): Translation | null {
  const index = INDEXES[domain];
  const key = normalizeTerm(term);
  return index.get(key) ?? index.get(singularize(key)) ?? null;
}

/** Which supported language a surface form is written in, given its translation. */
export function localeOf(term: string, t: Translation): Locale | "und" {
  const key = normalizeTerm(term);
  if (key === normalizeTerm(t.en) || singularize(key) === normalizeTerm(t.en)) {
    return "en";
  }
  if (key === normalizeTerm(t.de) || singularize(key) === normalizeTerm(t.de)) {
    return "de";
  }
  return "und";
}
