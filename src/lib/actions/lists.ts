"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { requireListPermission } from "@/lib/list-access";
import { visibilityWhere } from "@/lib/queries";
import {
  batchRecipeIdsSchema,
  listInviteEmailSchema,
  listNameSchema,
  listRoleSchema,
} from "@/lib/validations";

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

// --- Sharing ----------------------------------------------------------------

/**
 * Turn link sharing on (minting a fresh token), or off (clearing it). Owner
 * only.
 *
 * Calling this again while sharing is already on **rotates** the token, which
 * is how a link is revoked: anyone holding the old URL loses their way in,
 * while people who already joined keep their membership.
 */
export async function setListShareLink(
  listId: string,
  enabled: boolean,
  role: "VIEWER" | "EDITOR" = "EDITOR",
) {
  const user = await requireUser();
  const parsedRole = listRoleSchema.parse(role);
  await requireListPermission(user, listId, "OWNER");

  // 32 bytes of randomness, url-safe. Long enough that the link itself is the
  // secret — there is no other check on the join route.
  const shareToken = enabled ? randomBytes(32).toString("base64url") : null;

  await prisma.recipeList.update({
    where: { id: listId },
    data: { shareToken, shareRole: parsedRole },
  });

  revalidateList(listId);
  return { shareToken };
}

/**
 * Join a list from its share link. Any signed-in user holding the token
 * becomes a member at the role the owner chose.
 *
 * The owner opening their own link is a no-op rather than an error, and an
 * existing member keeps the role they already have — re-joining must never
 * silently downgrade an editor to a viewer.
 */
export async function joinListByToken(token: string) {
  const user = await requireUser();

  const list = await prisma.recipeList.findUnique({
    where: { shareToken: token },
    select: { id: true, ownerId: true, shareRole: true },
  });
  if (!list) throw new Error("That share link is no longer valid.");

  if (list.ownerId !== user.id) {
    await prisma.recipeListMember.upsert({
      where: { listId_userId: { listId: list.id, userId: user.id } },
      create: { listId: list.id, userId: user.id, role: list.shareRole },
      update: {},
    });
  }

  revalidateList(list.id);
  return { listId: list.id };
}

/**
 * Share a list with someone by email address or username. Owner only.
 *
 * An email that already has an account, or any known username, becomes a
 * member immediately and the list shows up under "Shared with me". An email
 * with *no* account yet is held as a `RecipeListInvite` and consumed the first
 * time they sign in (see `consumePendingListInvites`, wired into the NextAuth
 * `signIn` event) — so you can share with someone before they have used the app.
 *
 * An unknown **username** is an error rather than a pending invite: invites are
 * keyed by email and settled during sign-in, and password accounts are created
 * by an admin, so there is nothing for a username invite to attach to and it
 * would sit unconsumed forever.
 */
export async function shareListWithEmail(
  listId: string,
  identifier: string,
  role: "VIEWER" | "EDITOR" = "EDITOR",
) {
  const user = await requireUser();
  const parsedRole = listRoleSchema.parse(role);
  await requireListPermission(user, listId, "OWNER");

  const raw = identifier.trim().toLowerCase();
  if (!raw) throw new Error("Enter an email address or username.");
  const looksLikeEmail = raw.includes("@");

  const target = looksLikeEmail
    ? // Google decides the casing of a stored address, so match
      // case-insensitively rather than trusting it to equal the input.
      await prisma.user.findFirst({
        where: { email: { equals: raw, mode: "insensitive" } },
        select: { id: true },
      })
    : await prisma.user.findUnique({
        where: { username: raw },
        select: { id: true },
      });

  if (target) {
    if (target.id === user.id) {
      throw new Error("You already own this list.");
    }
    await prisma.recipeListMember.upsert({
      where: { listId_userId: { listId, userId: target.id } },
      create: { listId, userId: target.id, role: parsedRole },
      // Re-sharing with an existing member updates their role, which is what
      // the owner just asked for by picking one.
      update: { role: parsedRole },
    });
    revalidateList(listId);
    return { status: "added" as const, email: raw };
  }

  if (!looksLikeEmail) {
    throw new Error(`No account with the username "${raw}".`);
  }

  const parsedEmail = listInviteEmailSchema.parse(raw);
  await prisma.recipeListInvite.upsert({
    where: { listId_email: { listId, email: parsedEmail } },
    create: { listId, email: parsedEmail, role: parsedRole, invitedById: user.id },
    update: { role: parsedRole },
  });

  revalidateList(listId);
  return { status: "invited" as const, email: parsedEmail };
}

/** Withdraw a pending email invite. Owner only. */
export async function revokeListInvite(listId: string, email: string) {
  const user = await requireUser();
  const parsedEmail = listInviteEmailSchema.parse(email);
  await requireListPermission(user, listId, "OWNER");

  await prisma.recipeListInvite.deleteMany({
    where: { listId, email: parsedEmail },
  });

  revalidateList(listId);
  return { ok: true };
}

/** Change a member's role. Owner only. */
export async function setListMemberRole(
  listId: string,
  userId: string,
  role: "VIEWER" | "EDITOR",
) {
  const user = await requireUser();
  const parsedRole = listRoleSchema.parse(role);
  await requireListPermission(user, listId, "OWNER");

  await prisma.recipeListMember.updateMany({
    where: { listId, userId },
    data: { role: parsedRole },
  });

  revalidateList(listId);
  return { ok: true };
}

/** Remove someone from a list. Owner only. */
export async function removeListMember(listId: string, userId: string) {
  const user = await requireUser();
  await requireListPermission(user, listId, "OWNER");

  await prisma.recipeListMember.deleteMany({ where: { listId, userId } });

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
