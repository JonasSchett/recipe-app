"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import {
  requireGroupPermission,
  withdrawGroupShares,
} from "@/lib/group-access";
import { groupNameSchema, listInviteEmailSchema } from "@/lib/validations";

// Family group mutations. The owner manages the group; any member may leave.
// Membership itself grants nothing of yours to anyone — it only makes the
// group a place you *can* share recipes and notes into (see recipes.ts and
// notes.ts), with your per-group defaults starting off.

function revalidateGroup(groupId: string): void {
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/account");
  // Group shares change what recipes and notes people can see.
  revalidatePath("/", "layout");
}

/** Create a group owned by — and containing — the current user. */
export async function createGroup(name: string) {
  const user = await requireUser();
  const parsed = groupNameSchema.parse(name);

  const group = await prisma.familyGroup.create({
    data: {
      name: parsed,
      ownerId: user.id,
      members: { create: { userId: user.id } },
    },
    select: { id: true },
  });

  revalidatePath("/groups");
  revalidatePath("/account");
  return { id: group.id };
}

/** Rename a group. Owner only. */
export async function renameGroup(groupId: string, name: string) {
  const user = await requireUser();
  const parsed = groupNameSchema.parse(name);
  await requireGroupPermission(user, groupId, "OWNER");

  await prisma.familyGroup.update({
    where: { id: groupId },
    data: { name: parsed },
  });

  revalidateGroup(groupId);
  return { id: groupId };
}

/** Delete a group. Owner only. Members, invites and every share cascade. */
export async function deleteGroup(groupId: string) {
  const user = await requireUser();
  await requireGroupPermission(user, groupId, "OWNER");

  await prisma.familyGroup.delete({ where: { id: groupId } });

  revalidatePath("/groups");
  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { id: groupId };
}

/**
 * Turn the join link on (minting a fresh token) or off. Owner only. Calling it
 * again while on **rotates** the token, revoking the old link; people who
 * already joined stay.
 */
export async function setGroupShareLink(groupId: string, enabled: boolean) {
  const user = await requireUser();
  await requireGroupPermission(user, groupId, "OWNER");

  const shareToken = enabled ? randomBytes(32).toString("base64url") : null;
  await prisma.familyGroup.update({
    where: { id: groupId },
    data: { shareToken },
  });

  revalidateGroup(groupId);
  return { shareToken };
}

/** Join a group from its link. Already being a member is a no-op. */
export async function joinGroupByToken(token: string) {
  const user = await requireUser();

  const group = await prisma.familyGroup.findUnique({
    where: { shareToken: token },
    select: { id: true },
  });
  if (!group) throw new Error("That invite link is no longer valid.");

  await prisma.familyGroupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    create: { groupId: group.id, userId: user.id },
    update: {},
  });

  revalidateGroup(group.id);
  return { groupId: group.id };
}

/**
 * Invite someone by email or username. Owner only.
 *
 * Same rules as sharing a list: a known email or username joins immediately;
 * an email with no account becomes a pending invite consumed on first sign-in;
 * an unknown username is an error, since there's no sign-in to attach it to.
 */
export async function inviteToGroup(groupId: string, identifier: string) {
  const user = await requireUser();
  await requireGroupPermission(user, groupId, "OWNER");

  const raw = identifier.trim().toLowerCase();
  if (!raw) throw new Error("Enter an email address or username.");
  const looksLikeEmail = raw.includes("@");

  const target = looksLikeEmail
    ? await prisma.user.findFirst({
        where: { email: { equals: raw, mode: "insensitive" } },
        select: { id: true },
      })
    : await prisma.user.findUnique({
        where: { username: raw },
        select: { id: true },
      });

  if (target) {
    if (target.id === user.id) throw new Error("You're already in this group.");
    await prisma.familyGroupMember.upsert({
      where: { groupId_userId: { groupId, userId: target.id } },
      create: { groupId, userId: target.id },
      update: {},
    });
    revalidateGroup(groupId);
    return { status: "added" as const, identifier: raw };
  }

  if (!looksLikeEmail) {
    throw new Error(`No account with the username "${raw}".`);
  }

  const email = listInviteEmailSchema.parse(raw);
  await prisma.familyGroupInvite.upsert({
    where: { groupId_email: { groupId, email } },
    create: { groupId, email, invitedById: user.id },
    update: {},
  });

  revalidateGroup(groupId);
  return { status: "invited" as const, identifier: email };
}

/** Withdraw a pending email invite. Owner only. */
export async function revokeGroupInvite(groupId: string, email: string) {
  const user = await requireUser();
  const parsed = listInviteEmailSchema.parse(email);
  await requireGroupPermission(user, groupId, "OWNER");

  await prisma.familyGroupInvite.deleteMany({ where: { groupId, email: parsed } });

  revalidateGroup(groupId);
  return { ok: true };
}

/**
 * Remove a member. Owner only, and not themselves — the owner deletes the
 * group instead. Whatever the member shared into the group is withdrawn.
 */
export async function removeGroupMember(groupId: string, userId: string) {
  const user = await requireUser();
  await requireGroupPermission(user, groupId, "OWNER");
  if (userId === user.id) {
    throw new Error("You own this group — delete it instead.");
  }

  await prisma.$transaction(async (tx) => {
    await withdrawGroupShares(tx, groupId, userId);
    await tx.familyGroupMember.deleteMany({ where: { groupId, userId } });
  });

  revalidateGroup(groupId);
  return { ok: true };
}

/**
 * Leave a group. The owner can't — they delete it, which is the honest
 * operation. Your recipes and notes stop being shared with it.
 */
export async function leaveGroup(groupId: string) {
  const user = await requireUser();
  const permission = await requireGroupPermission(user, groupId, "MEMBER");
  if (permission === "OWNER") {
    throw new Error("You own this group — delete it instead of leaving.");
  }

  await prisma.$transaction(async (tx) => {
    await withdrawGroupShares(tx, groupId, user.id);
    await tx.familyGroupMember.deleteMany({
      where: { groupId, userId: user.id },
    });
  });

  revalidatePath("/groups");
  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { ok: true };
}
