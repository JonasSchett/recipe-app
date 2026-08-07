"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { visibilityWhere } from "@/lib/queries";
import { recipeNoteSchema } from "@/lib/validations";

/**
 * Throws unless the current user may *view* `recipeId`.
 *
 * Note the guard is deliberately view permission, not `assertCanModifyRecipe`:
 * the whole point is to annotate other people's recipes. A note is stored
 * against the caller's own id, so this can never write to the recipe itself.
 */
async function assertCanViewRecipe(
  user: Awaited<ReturnType<typeof requireUser>>,
  recipeId: string,
): Promise<void> {
  const visible = await prisma.recipe.findFirst({
    where: { AND: [{ id: recipeId }, visibilityWhere(user)] },
    select: { id: true },
  });
  // Same message either way, so this can't be used to probe which ids exist.
  if (!visible) throw new Error("Recipe not found.");
}

/**
 * Create or replace the current user's note on a recipe. An empty body deletes
 * it, so "clear the text and save" is the same gesture as removing the note.
 */
export async function saveRecipeNote(recipeId: string, body: string) {
  const user = await requireUser();
  const parsed = recipeNoteSchema.parse(body);
  await assertCanViewRecipe(user, recipeId);

  if (!parsed) {
    await prisma.recipeNote.deleteMany({ where: { recipeId, userId: user.id } });
  } else {
    await prisma.recipeNote.upsert({
      where: { recipeId_userId: { recipeId, userId: user.id } },
      create: { recipeId, userId: user.id, body: parsed },
      update: { body: parsed },
    });
  }

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Remove the current user's note on a recipe. No-op when there isn't one. */
export async function deleteRecipeNote(recipeId: string) {
  const user = await requireUser();
  // `deleteMany` is scoped to the caller's own id, so there is nothing to
  // authorize beyond being signed in — it cannot touch anyone else's note.
  await prisma.recipeNote.deleteMany({ where: { recipeId, userId: user.id } });

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/");
  return { ok: true };
}
