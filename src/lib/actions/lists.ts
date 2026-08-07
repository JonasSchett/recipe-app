"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { requireListPermission } from "@/lib/list-access";
import { visibilityWhere } from "@/lib/queries";
import { batchRecipeIdsSchema, listNameSchema } from "@/lib/validations";

function revalidateList(listId: string): void {
  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/");
}

/** Create a list owned by the current user. */
export async function createList(name: string) {
  const user = await requireUser();
  const parsed = listNameSchema.parse(name);

  const list = await prisma.recipeList.create({
    data: { name: parsed, ownerId: user.id },
    select: { id: true },
  });

  revalidatePath("/lists");
  return { id: list.id };
}

/** Rename a list. Owner only. */
export async function renameList(listId: string, name: string) {
  const user = await requireUser();
  const parsed = listNameSchema.parse(name);
  await requireListPermission(user, listId, "OWNER");

  await prisma.recipeList.update({
    where: { id: listId },
    data: { name: parsed },
  });

  revalidateList(listId);
  return { id: listId };
}

/** Delete a list. Owner only. Items, members and invites cascade. */
export async function deleteList(listId: string) {
  const user = await requireUser();
  await requireListPermission(user, listId, "OWNER");

  await prisma.recipeList.delete({ where: { id: listId } });

  revalidatePath("/lists");
  revalidatePath("/");
  return { id: listId };
}

/**
 * Pin recipes to a list. Owner or editor.
 *
 * Only recipes the caller can currently *see* are pinned: without that check
 * someone could pin a recipe id they can't view and then read it back through
 * the list's own read grant. Already-pinned recipes are left where they are.
 */
export async function addRecipesToList(listId: string, recipeIds: string[]) {
  const user = await requireUser();
  const ids = batchRecipeIdsSchema.parse(recipeIds);
  await requireListPermission(user, listId, "EDITOR");

  const visible = await prisma.recipe.findMany({
    where: { AND: [{ id: { in: ids } }, visibilityWhere(user)] },
    select: { id: true },
  });

  const added = await prisma.$transaction(async (tx) => {
    const last = await tx.recipeListItem.findFirst({
      where: { listId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let position = (last?.position ?? -1) + 1;

    const result = await tx.recipeListItem.createMany({
      data: visible.map((recipe) => ({
        listId,
        recipeId: recipe.id,
        addedById: user.id,
        position: position++,
      })),
      skipDuplicates: true,
    });
    // Touch the list so it sorts to the top of "recently active".
    await tx.recipeList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
    });
    return result.count;
  });

  revalidateList(listId);
  return { added, skipped: ids.length - added };
}

/** Unpin a recipe. Owner or editor. */
export async function removeRecipeFromList(listId: string, recipeId: string) {
  const user = await requireUser();
  await requireListPermission(user, listId, "EDITOR");

  await prisma.recipeListItem.deleteMany({ where: { listId, recipeId } });

  revalidateList(listId);
  return { ok: true };
}

/**
 * Move a pinned recipe one place up or down, by swapping positions with its
 * neighbour. Owner or editor.
 */
export async function moveListItem(
  listId: string,
  recipeId: string,
  direction: "up" | "down",
) {
  const user = await requireUser();
  await requireListPermission(user, listId, "EDITOR");

  await prisma.$transaction(async (tx) => {
    const current = await tx.recipeListItem.findUnique({
      where: { listId_recipeId: { listId, recipeId } },
      select: { position: true },
    });
    if (!current) throw new Error("That recipe is not on this list.");

    const neighbour = await tx.recipeListItem.findFirst({
      where: {
        listId,
        position:
          direction === "up"
            ? { lt: current.position }
            : { gt: current.position },
      },
      orderBy: { position: direction === "up" ? "desc" : "asc" },
      select: { recipeId: true, position: true },
    });
    // Already at the end it's moving toward — nothing to do.
    if (!neighbour) return;

    // Positions are unique only by convention, so a plain swap is safe.
    await tx.recipeListItem.update({
      where: { listId_recipeId: { listId, recipeId } },
      data: { position: neighbour.position },
    });
    await tx.recipeListItem.update({
      where: { listId_recipeId: { listId, recipeId: neighbour.recipeId } },
      data: { position: current.position },
    });
  });

  revalidateList(listId);
  return { ok: true };
}

/**
 * Leave a list you were added to. Owners can't leave their own list — they
 * delete it instead, which is the honest operation.
 */
export async function leaveList(listId: string) {
  const user = await requireUser();
  const permission = await requireListPermission(user, listId, "VIEWER");
  if (permission === "OWNER") {
    throw new Error("You own this list — delete it instead of leaving.");
  }

  await prisma.recipeListMember.deleteMany({
    where: { listId, userId: user.id },
  });

  revalidatePath("/lists");
  revalidatePath("/");
  return { ok: true };
}
