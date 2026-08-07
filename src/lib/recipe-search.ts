import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fold } from "@/lib/suggest";

// Fuzzy recipe search, backed by Postgres `pg_trgm` + `unaccent`.
//
// Plain `contains` matching (what this replaced) finds substrings but not
// typos: "quokka" found "quokkaberries", "quokaberries" found nothing.
//
// Two mechanisms, because neither alone is enough:
//
//   1. **Folding** puts both sides into the same shape before comparing, which
//      is what handles umlauts. Trigram similarity can't: "puree"/"püree" share
//      too few triplets in a word that short to clear any sane threshold.
//   2. **Trigram similarity** then absorbs actual typos and missing letters.
//
// The folding deliberately mirrors `lib/suggest.ts`, which powers the
// ingredient/tag autocomplete — same two keys, so search and autocomplete agree
// on what "close enough" means and "suss", "suess" and "süß" all reach "süß".
//
// This runs as a *prefilter*: it returns recipe ids ranked by relevance, which
// `getRecipes` feeds into the ordinary Prisma query as an `id IN (…)` filter.
// Visibility rules, tag/ingredient filters and the typed includes all stay
// where they were, with the messy text matching isolated here.

/**
 * Ceiling on how many candidates the fuzzy pass hands back. The caller loads
 * this many recipes at most (with includes) before paginating in memory, so it
 * bounds the cost of a very common search term. Far above any plausible result
 * count for a household recipe box.
 */
const CANDIDATE_LIMIT = 500;

/**
 * A search is one scan of the recipes plus their tag/ingredient joins, since
 * the comparison is against *folded* expressions that no index on the raw
 * columns could serve. Negligible for a household recipe box. If it ever isn't,
 * materialize the folded text as a stored column maintained on write and put a
 * GIN trigram index on that.
 */

/**
 * Relative worth of a hit per field, applied to its match score. A term in the
 * title beats the same term buried in step 7 of the instructions.
 */
const WEIGHT = {
  title: 1.0,
  description: 0.9,
  // Tag/ingredient hits are curated vocabulary, so they mean more than prose.
  entity: 0.9,
  // Something you wrote yourself is a strong signal — you are likely searching
  // for the words you chose ("the one I said needed longer").
  note: 0.85,
  instructions: 0.8,
} as const;

/**
 * Minimum trigram similarity that counts as a match, chosen from measured
 * values rather than taste. Real single-letter typos on this data score 0.50
 * ("spageti"/"spaghetti") to 0.80 ("quokaberries"/"quokkaberries"), while
 * unrelated word pairs top out around 0.25 ("pea"/"parsley"). 0.45 sits in the
 * gap, so every plausible typo lands and nothing unrelated does.
 *
 * Note this is deliberately below Postgres' own default of 0.6, which cuts off
 * ordinary misspellings like "spagetti" (0.58).
 */
const FUZZY_THRESHOLD = 0.45;

export type RankedRecipeId = { id: string; score: number };

/** Escape LIKE wildcards so a typed `%` or `_` matches literally. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * SQL mirror of `fold()` in `lib/suggest.ts`: lowercase, `ß`→`ss`, diacritics
 * dropped. "Kartoffelpüree" → "kartoffelpuree".
 */
function folded(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`unaccent(replace(lower(coalesce(${column}, '')), 'ß', 'ss'))`;
}

/**
 * SQL mirror of `foldExpanded()` in `lib/suggest.ts`: the *expanded* umlaut
 * convention a keyboard-less typist reaches for. "süß" → "suess". The umlaut
 * replacements must run before `unaccent`, which would otherwise flatten them
 * to bare vowels first.
 */
function foldedExpanded(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`unaccent(replace(replace(replace(replace(lower(coalesce(${column}, '')), 'ß', 'ss'), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'))`;
}

/**
 * Recipe ids matching `term`, best first. Matches the recipe's own text, any
 * localized tag/ingredient alias, and `viewerId`'s own notes — each both as a
 * substring and fuzzily.
 *
 * `viewerId` scopes the notes branch and must be the *current* user: it is what
 * stops one person's private notes from surfacing another person's results.
 *
 * Ignores visibility — the caller is responsible for applying `visibilityWhere`
 * to the ids this returns.
 */
export async function searchRecipeIds(
  term: string,
  viewerId: string,
): Promise<RankedRecipeId[]> {
  // Fold the query once; every comparison below is folded-against-folded.
  const query = fold(term);
  if (!query) return [];
  const like = `%${escapeLike(query)}%`;

  /**
   * `word_similarity` against one folded form, or 0 when it is too weak to
   * count. Scoring the query against the closest run of words in the field is
   * the right shape for a short query against long instructions.
   */
  const fuzzy = (target: Prisma.Sql): Prisma.Sql =>
    Prisma.sql`(CASE WHEN word_similarity(${query}::text, ${target}) >= ${FUZZY_THRESHOLD}::real
                     THEN word_similarity(${query}::text, ${target}) ELSE 0 END)`;

  /**
   * How well `column` matches, weighted, or 0 for no match at all. A literal
   * (post-folding) substring hit scores a flat 1 — the user's exact term is
   * present, which no fuzzy score should be allowed to outrank.
   */
  const score = (column: Prisma.Sql, weight: number): Prisma.Sql => {
    const [key, expanded] = [folded(column), foldedExpanded(column)];
    return Prisma.sql`${weight}::double precision * GREATEST(
      CASE WHEN ${key} LIKE ${like} OR ${expanded} LIKE ${like} THEN 1 ELSE 0 END,
      ${fuzzy(key)},
      ${fuzzy(expanded)}
    )`;
  };

  const title = Prisma.raw('r."title"');
  const description = Prisma.raw('r."description"');
  const instructions = Prisma.raw('r."instructions"');
  const alias = Prisma.raw('n."normalized"');
  const noteBody = Prisma.raw('rn."body"');

  // Every candidate is scored and the non-matches (score 0) are dropped by the
  // HAVING, rather than repeating the match test as a WHERE. That means a scan
  // per search — deliberate at this scale, see the note on CANDIDATE_LIMIT.
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    WITH scored AS (
      SELECT
        r.id,
        GREATEST(
          ${score(title, WEIGHT.title)},
          ${score(description, WEIGHT.description)},
          ${score(instructions, WEIGHT.instructions)}
        ) AS score
      FROM "Recipe" r

      UNION ALL

      -- Cross-lingual: every ingredient carries all of its surface forms, so
      -- searching "Onion" still reaches a recipe that stored "Zwiebel".
      SELECT ri."recipeId" AS id, ${score(alias, WEIGHT.entity)} AS score
      FROM "RecipeIngredient" ri
      JOIN "IngredientName" n ON n."ingredientId" = ri."ingredientId"

      UNION ALL

      SELECT rt."recipeId" AS id, ${score(alias, WEIGHT.entity)} AS score
      FROM "RecipeTag" rt
      JOIN "TagName" n ON n."tagId" = rt."tagId"

      UNION ALL

      -- The viewer's OWN notes only. Without this predicate a search would leak
      -- the existence of other people's private notes through the results.
      SELECT rn."recipeId" AS id, ${score(noteBody, WEIGHT.note)} AS score
      FROM "RecipeNote" rn
      WHERE rn."userId" = ${viewerId}
    )
    SELECT id, MAX(score)::double precision AS score
    FROM scored
    GROUP BY id
    HAVING MAX(score) > 0
    -- id breaks ties so paging is stable across requests.
    ORDER BY score DESC, id ASC
    LIMIT ${CANDIDATE_LIMIT}
  `;

  return rows;
}
