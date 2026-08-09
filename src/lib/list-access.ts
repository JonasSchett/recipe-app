import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth-guards";

// Authorization for shared recipe lists. Every list query and mutation goes
// through here, the way recipes go through `visibilityWhere` /
// `assertCanModifyRecipe`.
//
// Note this deliberately does NOT give admins blanket access. Recipes are
// library content an admin curates; a list is a social object between specific
// people, and "the admin can read everyone's meal plans" is not a property
// worth having. Admins reach a list the same way anyone else does: by owning
// it or being invited.

/** Effective permission on a list. Owner is implicit — owners have no member row. */
export type ListPermission = "OWNER" | "EDITOR" | "VIEWER";

/**
 * Prisma `where` fragment restricting lists to those a user may see at all:
 * their own plus any they've been added to.
 */
export function listAccessWhere(user: SessionUser): Prisma.RecipeListWhereInput {
  return {
    OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
  };
}

/**
 * The user's permission on a list, or `null` when they have none (which
 * callers should treat as "does not exist" — never confirm a list id to
 * someone with no access to it).
 */
export async function getListPermission(
  user: SessionUser,
  listId: string,
): Promise<ListPermission | null> {
  const list = await prisma.recipeList.findUnique({
    where: { id: listId },
    select: {
      ownerId: true,
      members: { where: { userId: user.id }, select: { role: true } },
    },
  });
  if (!list) return null;
  if (list.ownerId === user.id) return "OWNER";
  const membership = list.members[0];
  if (!membership) return null;
  return membership.role === "EDITOR" ? "EDITOR" : "VIEWER";
}

const RANK: Record<ListPermission, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

/**
 * Throws unless the user holds at least `minimum` on the list. The error text
 * is identical for "no such list" and "no access", so it can't be used to
 * discover which list ids exist.
 */
export async function requireListPermission(
  user: SessionUser,
  listId: string,
  minimum: ListPermission,
): Promise<ListPermission> {
  const permission = await getListPermission(user, listId);
  if (!permission || RANK[permission] < RANK[minimum]) {
    throw new Error("List not found.");
  }
  return permission;
}
