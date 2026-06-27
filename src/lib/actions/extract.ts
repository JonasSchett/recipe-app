"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { COMMON_INGREDIENTS, COMMON_TAGS } from "@/lib/extraction/dictionary";
import { matchEntities } from "@/lib/extraction/match";

/**
 * Build a matching vocabulary from the curated seed plus the live DB names,
 * de-duplicated case-insensitively. DB casing wins, so suggestions reuse the
 * exact stored name (and resolve to the existing row on save).
 */
function unionVocab(seed: string[], dbNames: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const name of seed) byKey.set(name.toLowerCase(), name);
  for (const name of dbNames) byKey.set(name.toLowerCase(), name);
  return [...byKey.values()];
}

/**
 * Scan free text for ingredients and tags already known to the app (curated
 * seed ∪ everything in the DB) and return the matches. Suggestion-only — it
 * persists nothing; the form pre-fills these for the user to review, and they
 * become real rows when the recipe is saved.
 */
export async function extractEntitiesFromText(
  text: string,
): Promise<{ ingredients: string[]; tags: string[] }> {
  await requireUser();
  if (!text.trim()) return { ingredients: [], tags: [] };

  const [dbIngredients, dbTags] = await Promise.all([
    prisma.ingredient.findMany({ select: { name: true } }),
    prisma.tag.findMany({ select: { name: true } }),
  ]);

  return {
    ingredients: matchEntities(
      text,
      unionVocab(COMMON_INGREDIENTS, dbIngredients.map((i) => i.name)),
    ),
    tags: matchEntities(
      text,
      unionVocab(COMMON_TAGS, dbTags.map((t) => t.name)),
    ),
  };
}
