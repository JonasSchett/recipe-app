// Pure (no I/O) matcher powering the ingredient/tag autocomplete, in the same
// spirit as `extraction/match.ts`: no Prisma, no React, so it can be unit-tested
// and shared by the server (assembling the vocabulary) and the client
// (filtering it on every keystroke).
//
// The point of the folding below is cross-lingual, diacritic-tolerant typing:
// because every entity carries all of its surface forms (English canonical plus
// localized aliases), typing "Kart" surfaces "Kartoffel" even though the entity
// is stored as "Potato".

import type { Translation } from "@/lib/i18n/dictionary";

/** One autocompletable entity with every surface form it answers to. */
export type EntitySuggestion = {
  /** DB entity id, or `null` for a curated dictionary term with no row yet. */
  id: string | null;
  /** English canonical label (the entity's stable identity). */
  canonical: string;
  /** Every surface form: canonical + localized aliases. */
  names: string[];
  /** How many recipes use it — the primary relevance signal. */
  recipeCount: number;
  /** Which domain this came from; only set where both are merged (filters). */
  kind?: "tag" | "ingredient";
};

export type RankedSuggestion = {
  entity: EntitySuggestion;
  /** The surface form that matched — this is what gets inserted on pick. */
  label: string;
  /** A different name worth showing alongside (usually the other language). */
  secondary: string | null;
};

// Match quality, best first. Ordering matters more than the numbers.
const EXACT = 0;
const PREFIX = 1;
const WORD_PREFIX = 2;
const SUBSTRING = 3;
const NO_MATCH = 99;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Comparison key for a term: lowercased, whitespace-collapsed, `ß`→`ss`, and
 * diacritics dropped — matching how umlauts usually get typed on a phone
 * keyboard ("Kartoffelpuree" for "Kartoffelpüree", "suss" for "süß").
 */
export function fold(s: string): string {
  return stripDiacritics(s.normalize("NFC").toLowerCase().replace(/ß/g, "ss"))
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Second key for terms containing umlauts, using the *expanded* convention
 * ("ue" for "ü") that a German keyboard-less typist may reach for instead.
 * Returns null when the term has no umlauts, so it adds no keys for most terms.
 */
function foldExpanded(s: string): string | null {
  const lower = s.normalize("NFC").toLowerCase();
  if (!/[äöüß]/.test(lower)) return null;
  return stripDiacritics(
    lower
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss"),
  )
    .trim()
    .replace(/\s+/g, " ");
}

type IndexedName = { name: string; keys: string[] };
type IndexedEntity = { entity: EntitySuggestion; names: IndexedName[] };

/** A vocabulary with its comparison keys precomputed. Build once, query often. */
export type VocabularyIndex = IndexedEntity[];

/**
 * Precompute the fold keys for a vocabulary. Callers should memoize this (the
 * autocomplete does, per vocabulary prop) so per-keystroke filtering is a plain
 * string scan over ready-made keys.
 */
export function indexVocabulary(vocabulary: EntitySuggestion[]): VocabularyIndex {
  return vocabulary.map((entity) => {
    const seen = new Set<string>();
    const names: IndexedName[] = [];
    for (const name of [entity.canonical, ...entity.names]) {
      const key = fold(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const expanded = foldExpanded(name);
      names.push({ name, keys: expanded ? [key, expanded] : [key] });
    }
    return { entity, names };
  });
}

/** Best (lowest) score of `query` against any of a surface form's keys. */
function scoreName(keys: string[], query: string): number {
  let best = NO_MATCH;
  for (const key of keys) {
    let score = NO_MATCH;
    if (key === query) score = EXACT;
    else if (key.startsWith(query)) score = PREFIX;
    // Word-prefix so "Bohne" finds "Grüne Bohne"; a mid-word hit like "puree"
    // in "Kartoffelpüree" still matches, just one rank lower.
    else if (key.split(/[\s-]+/).some((w) => w.startsWith(query))) score = WORD_PREFIX;
    else if (key.includes(query)) score = SUBSTRING;
    if (score < best) best = score;
  }
  return best;
}

/**
 * Rank a vocabulary against what the user has typed, returning at most `limit`
 * entries — **one row per entity**, never one per alias, so "Kar" yields a
 * single Kartoffel row and a single Karotte row rather than four.
 *
 * Ordering: match quality (exact → prefix → word-prefix → substring), then
 * recipe count descending, then the shorter label, then alphabetically. Entities
 * whose surface forms are all in `exclude` are dropped, so already-picked tags
 * and ingredients stop being offered.
 */
export function rankSuggestions(
  query: string,
  index: VocabularyIndex,
  { limit = 8, exclude = [] }: { limit?: number; exclude?: string[] } = {},
): RankedSuggestion[] {
  const q = fold(query);
  if (!q) return [];

  const excluded = new Set(exclude.map(fold).filter(Boolean));

  const hits: { ranked: RankedSuggestion; score: number }[] = [];
  for (const { entity, names } of index) {
    if (names.some(({ keys }) => excluded.has(keys[0]))) continue;

    // Pick the entity's best-matching surface form as the row's label.
    let best: IndexedName | null = null;
    let bestScore = NO_MATCH;
    for (const candidate of names) {
      const score = scoreName(candidate.keys, q);
      if (
        score < bestScore ||
        (score === bestScore && best && candidate.name.length < best.name.length)
      ) {
        best = candidate;
        bestScore = score;
      }
    }
    if (!best || bestScore === NO_MATCH) continue;

    // Show the other-language name as context, but never repeat the label.
    const label = best.name;
    const labelKey = fold(label);
    const secondary =
      fold(entity.canonical) !== labelKey
        ? entity.canonical
        : (names.find((n) => n.keys[0] !== labelKey)?.name ?? null);

    hits.push({ ranked: { entity, label, secondary }, score: bestScore });
  }

  hits.sort(
    (a, b) =>
      a.score - b.score ||
      b.ranked.entity.recipeCount - a.ranked.entity.recipeCount ||
      a.ranked.label.length - b.ranked.label.length ||
      a.ranked.label.localeCompare(b.ranked.label),
  );

  return hits.slice(0, limit).map((h) => h.ranked);
}

/**
 * Fold the curated dictionary into a stored vocabulary, in two ways:
 *
 * 1. **Enrich** a stored entity with translations it is missing. Rows written
 *    before the multilingual alias code (or by any path that skipped
 *    `resolveTagId`/`resolveIngredientId`) often carry only their English
 *    alias, so a stored "Garlic" would never answer to "Knoblauch" — this puts
 *    the German form back on the suggestion without touching the database.
 * 2. **Append** dictionary terms no stored entity covers at all, as `id: null`
 *    suggestions. On a young database that's most of the vocabulary; as recipes
 *    accumulate, real entities take over the top because these always sort last
 *    on recipe count.
 *
 * A translation whose two sides match two *different* stored entities is left
 * alone — merging them is a data decision, not a display one.
 */
export function withDictionary(
  stored: EntitySuggestion[],
  translations: Translation[],
  kind?: "tag" | "ingredient",
): EntitySuggestion[] {
  const merged: EntitySuggestion[] = stored.map((entity) => ({
    ...entity,
    names: [...entity.names],
  }));

  const byName = new Map<string, EntitySuggestion>();
  for (const entity of merged) {
    for (const name of [entity.canonical, ...entity.names]) {
      const key = fold(name);
      if (key && !byName.has(key)) byName.set(key, entity);
    }
  }

  const extra: EntitySuggestion[] = [];
  for (const { en, de } of translations) {
    const enHit = byName.get(fold(en));
    const deHit = byName.get(fold(de));

    if (enHit && deHit) continue; // both known — nothing to add (or ambiguous)

    const hit = enHit ?? deHit;
    if (hit) {
      const missing = enHit ? de : en;
      if (fold(missing) && !byName.has(fold(missing))) {
        hit.names.push(missing);
        byName.set(fold(missing), hit);
      }
      continue;
    }

    const entity: EntitySuggestion = {
      id: null,
      canonical: en,
      names: en === de ? [en] : [en, de],
      recipeCount: 0,
      kind,
    };
    byName.set(fold(en), entity);
    byName.set(fold(de), entity);
    extra.push(entity);
  }

  return [...merged, ...extra];
}
