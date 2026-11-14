import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth-guards";

// Authorization for family groups. Every group query and mutation goes through
// here, the way lists go through `list-access.ts`.
//
// As with lists, admins get NO blanket access: a family group is a social
// object between specific people, not library content.
//
// Unlike lists, the owner also has a member row, so "is in this group" is a
// single membership check for everyone and `ownerId` only decides who manages.

/** Prisma `where` fragment for groups the user belongs to (owner included). */
export function groupMemberWhere(
  user: SessionUser,
): Prisma.FamilyGroupWhereInput {
  return { members: { some: { userId: user.id } } };
}

/**
 * The user's standing in a group, or `null` when they aren't in it — which
 * callers treat as "does not exist", so group ids can't be probed.
 */
export async function getGroupPermission(
  user: SessionUser,
  groupId: string,
): Promise<"OWNER" | "MEMBER" | null> {
  const group = await prisma.familyGroup.findFirst({
    where: { id: groupId, ...groupMemberWhere(user) },
    select: { ownerId: true },
  });
  if (!group) return null;
  return group.ownerId === user.id ? "OWNER" : "MEMBER";
}

/**
 * Throws unless the user is in the group (and owns it, when `ownerOnly`).
 * Same message for "no such group" and "no access".
 */
export async function requireGroupPermission(
  user: SessionUser,
  groupId: string,
  minimum: "OWNER" | "MEMBER",
): Promise<"OWNER" | "MEMBER"> {
  const permission = await getGroupPermission(user, groupId);
  if (!permission || (minimum === "OWNER" && permission !== "OWNER")) {
    throw new Error("Group not found.");
  }
  return permission;
}

/**
 * Throws unless `userId` belongs to every group in `groupIds` (already
 * deduplicated by `groupIdsSchema`). Refused rather than silently dropped, so
 * a stale form — you left the group in another tab — fails loudly instead of
 * saving something shared differently than it says.
 */
export async function assertMemberOfGroups(
  tx: Prisma.TransactionClient,
  userId: string,
  groupIds: string[],
): Promise<void> {
  if (groupIds.length === 0) return;
  const count = await tx.familyGroupMember.count({
    where: { userId, groupId: { in: groupIds } },
  });
  if (count !== groupIds.length) throw new Error("Group not found.");
}

/**
 * Remove everything `userId` has shared into a group — their recipes and their
 * notes. Run when someone leaves or is removed: sharing was a choice made *as a
 * member*, and it shouldn't outlive the membership.
 */
export async function withdrawGroupShares(
  tx: Prisma.TransactionClient,
  groupId: string,
  userId: string,
): Promise<void> {
  await tx.recipeGroupShare.deleteMany({
    where: { groupId, recipe: { authorId: userId } },
  });
  await tx.recipeNoteGroupShare.deleteMany({ where: { groupId, userId } });
}

/**
 * Replace a recipe's group shares with `groupIds`, all of which `authorId` must
 * belong to. Wholesale replacement is safe because only the author ever
 * creates these rows, and leaving a group withdraws them — so every existing
 * share is in one of the author's own groups and is theirs to restate.
 */
export async function setRecipeGroupShares(
  tx: Prisma.TransactionClient,
  recipeId: string,
  authorId: string,
  groupIds: string[],
): Promise<void> {
  await assertMemberOfGroups(tx, authorId, groupIds);
  await tx.recipeGroupShare.deleteMany({ where: { recipeId } });
  if (groupIds.length > 0) {
    await tx.recipeGroupShare.createMany({
      data: groupIds.map((groupId) => ({ recipeId, groupId })),
    });
  }
}
