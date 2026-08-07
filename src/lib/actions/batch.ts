"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, type SessionUser } from "@/lib/auth-guards";
import {
  batchIngredientsSchema,
  batchTagsSchema,
  type BatchIngredientsInput,
  type BatchTagsInput,
} from "@/lib/validations";
import { resolveIngredients, resolveTags } from "@/lib/actions/_shared";
import { getFilteredRecipeIds } from "@/lib/queries";

/**
 * Ids of every recipe matching the current filter, for "select all matching".
 *
 * A read, but it lives in an action module because a Client Component cannot
 * import `queries.ts` (it pulls in Prisma) — a Server Action is the only way
 * to reach it from the selection bar. `getFilteredRecipeIds` applies the
 * caller's own visibility rules and the batch cap.
 */
export async function getSelectableRecipeIds(filter: {
  search?: string;
  tagIds?: string[];
  ingredientIds?: string[];
}) {
  return getFilteredRecipeIds(filter);
}

export type BatchResult = {
  /** Recipes actually written to. */
  updated: number;
  /** Requested but left alone — not yours, or gone. */
  skipped: number;
};

/**
 * Narrow requested ids to the ones this user may modify.
 *
 * Anything they don't own (and aren't admin for) is silently skipped rather
 * than failing the whole batch: the list mixes your recipes with other
 * people's, so a partial apply is the useful behaviour. The count comes back
 * so the UI can say so out loud instead of quietly doing less than asked.
 */
async function modifiableRecipeIds(
  user: SessionUser,
  recipeIds: string[],
): Promise<string[]> {
  const rows = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, authorId: true },
  });
  return rows
    .filter((row) => user.role === "ADMIN" || row.authorId === user.id)
    .map((row) => row.id);
}

function revalidateLists(): void {
  revalidatePath("/");
  revalidatePath("/recipes");
}

/**
 * Add tags to many recipes at once. Existing tags on a recipe are untouched;
 * a tag already present is left as it is.
 */
export async function addTagsToRecipes(
  input: BatchTagsInput,
): Promise<BatchResult> {
  const user = await requireUser();
  const { recipeIds, tags } = batchTagsSchema.parse(input);

  const targets = await modifiableRecipeIds(user, recipeIds);
  if (targets.length === 0) {
    return { updated: 0, skipped: recipeIds.length };
  }

  await prisma.$transaction(async (tx) => {
    // Resolve once, not per recipe: resolveTags does several queries per name
    // and may create alias rows, so doing it inside the loop would multiply all
    // of that by the number of selected recipes.
    const resolved = await resolveTags(tx, tags);
    await tx.recipeTag.createMany({
      data: targets.flatMap((recipeId) =>
        resolved.map(({ tagId, displayName }) => ({
          recipeId,
          tagId,
          displayName,
        })),
      ),
      // The composite PK makes re-tagging a no-op instead of an error.
      skipDuplicates: true,
    });
  });

  revalidateLists();
  return { updated: targets.length, skipped: recipeIds.length - targets.length };
}

/**
 * Add ingredients to many recipes at once.
 *
 * A recipe that already lists an ingredient keeps its existing quantity and
 * unit — `skipDuplicates` means this only ever adds lines, never rewrites one.
 * That is the conservative reading of "add to these recipes": a bulk action
 * should not silently change amounts someone entered by hand.
 */
export async function addIngredientsToRecipes(
  input: BatchIngredientsInput,
): Promise<BatchResult> {
  const user = await requireUser();
  const { recipeIds, ingredients } = batchIngredientsSchema.parse(input);

  const targets = await modifiableRecipeIds(user, recipeIds);
  if (targets.length === 0) {
    return { updated: 0, skipped: recipeIds.length };
  }

  await prisma.$transaction(async (tx) => {
    const resolved = await resolveIngredients(tx, ingredients);
    await tx.recipeIngredient.createMany({
      data: targets.flatMap((recipeId) =>
        resolved.map((row) => ({ recipeId, ...row })),
      ),
      skipDuplicates: true,
    });
  });

  revalidateLists();
  return { updated: targets.length, skipped: recipeIds.length - targets.length };
}
