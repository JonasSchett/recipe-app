"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { requireGroupPermission } from "@/lib/group-access";
import { shareExistingSchema, type ShareExistingInput } from "@/lib/validations";

/**
 * Change sharing on *all* of the caller's existing recipes or notes at once:
 * share them with everyone (`groupId: null`) or with one of their groups — the
 * catch-up for items saved before a default was switched on — or stop sharing
 * them all with a group.
 *
 * Strictly the caller's *own* items: an admin may edit anyone's recipe, but a
 * one-click "publish everyone's recipes" is not a power worth having. There is
 * no bulk "make everything private" (the schema refuses it): that would also
 * revert items made public on purpose, which is not an undo of this. Returns
 * how many items changed.
 */
export async function setAllExistingSharing(input: ShareExistingInput) {
  const user = await requireUser();
  const { kind, groupId, share } = shareExistingSchema.parse(input);
  if (groupId) await requireGroupPermission(user, groupId, "MEMBER");

  let changed: number;

  if (groupId === null) {
    const result =
      kind === "recipes"
        ? await prisma.recipe.updateMany({
            where: { authorId: user.id, visibility: "PRIVATE" },
            data: { visibility: "PUBLIC" },
          })
        : await prisma.recipeNote.updateMany({
            where: { userId: user.id, visibility: "PRIVATE" },
            data: { visibility: "PUBLIC" },
          });
    changed = result.count;
  } else if (kind === "recipes") {
    if (share) {
      const recipes = await prisma.recipe.findMany({
        where: { authorId: user.id },
        select: { id: true },
      });
      const result = await prisma.recipeGroupShare.createMany({
        data: recipes.map(({ id }) => ({ recipeId: id, groupId })),
        skipDuplicates: true,
      });
      changed = result.count;
    } else {
      const result = await prisma.recipeGroupShare.deleteMany({
        where: { groupId, recipe: { authorId: user.id } },
      });
      changed = result.count;
    }
  } else if (share) {
    const notes = await prisma.recipeNote.findMany({
      where: { userId: user.id },
      select: { recipeId: true },
    });
    const result = await prisma.recipeNoteGroupShare.createMany({
      data: notes.map(({ recipeId }) => ({ recipeId, userId: user.id, groupId })),
      skipDuplicates: true,
    });
    changed = result.count;
  } else {
    const result = await prisma.recipeNoteGroupShare.deleteMany({
      where: { groupId, userId: user.id },
    });
    changed = result.count;
  }

  revalidatePath("/", "layout");
  return { changed };
}
