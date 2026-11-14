"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { visibilityWhere } from "@/lib/queries";
import { assertMemberOfGroups } from "@/lib/group-access";
import {
  noteSharingSchema,
  recipeNoteSchema,
  type NoteSharingInput,
} from "@/lib/validations";

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
 * Create or replace the current user's note on a recipe, along with who it's
 * shared with. An empty body deletes it (and its shares, which cascade), so
 * "clear the text and save" is the same gesture as removing the note.
 *
 * `sharing` is restated in full on every save and defaults to private when
 * omitted. Group shares are limited to groups the caller belongs to; nobody
 * can see the note who can't already see the recipe (see `getSharedNotes`).
 */
export async function saveRecipeNote(
  recipeId: string,
  body: string,
  sharing: NoteSharingInput = {},
) {
  const user = await requireUser();
  const parsed = recipeNoteSchema.parse(body);
  const { visibility, groupIds } = noteSharingSchema.parse(sharing);
  await assertCanViewRecipe(user, recipeId);

  if (!parsed) {
    await prisma.recipeNote.deleteMany({ where: { recipeId, userId: user.id } });
  } else {
    await prisma.$transaction(async (tx) => {
      await assertMemberOfGroups(tx, user.id, groupIds);
      await tx.recipeNote.upsert({
        where: { recipeId_userId: { recipeId, userId: user.id } },
        create: { recipeId, userId: user.id, body: parsed, visibility },
        update: { body: parsed, visibility },
      });
      await tx.recipeNoteGroupShare.deleteMany({
        where: { recipeId, userId: user.id },
      });
      if (groupIds.length > 0) {
        await tx.recipeNoteGroupShare.createMany({
          data: groupIds.map((groupId) => ({ recipeId, userId: user.id, groupId })),
        });
      }
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
