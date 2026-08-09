"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { assertPasswordAuthEnabled, passwordIdentifier } from "@/lib/auth-methods";
import { hashPassword } from "@/lib/password";
import { revokeOtherSessions } from "@/lib/session-cookie";
import {
  listInviteEmailSchema,
  newPasswordSchema,
  roleSchema,
  usernameSchema,
} from "@/lib/validations";

/**
 * Promote or demote a user. Admin-only. An admin cannot change their own role —
 * this prevents an admin from accidentally locking themselves out, and
 * guarantees at least one admin always remains (the actor).
 */
export async function setUserRole(userId: string, role: "ADMIN" | "USER") {
  const actor = await requireAdmin();
  const parsed = roleSchema.parse(role);

  if (userId === actor.id) {
    throw new Error("You can't change your own role.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) throw new Error("User not found.");

  await prisma.user.update({ where: { id: userId }, data: { role: parsed } });
  revalidatePath("/admin/users");
  return { id: userId, role: parsed };
}

// --- Google allowlist -------------------------------------------------------

/**
 * Let an email address sign in with Google. Admin-only.
 *
 * Adding the first entry turns the gate *on* for everyone: with both the env
 * var and this table empty the app accepts any Google account, so the UI warns
 * about that before the first add.
 */
export async function allowGoogleEmail(email: string) {
  const actor = await requireAdmin();
  const parsed = listInviteEmailSchema.parse(email);

  await prisma.allowedEmail.upsert({
    where: { email: parsed },
    create: { email: parsed, addedById: actor.id },
    update: {},
  });

  revalidatePath("/admin/users");
  return { email: parsed };
}

/**
 * Withdraw an address. Admin-only.
 *
 * Also ends that person's sessions: the `signIn` callback only runs at sign-in,
 * so without this they would keep a working session for up to 30 days and
 * "removed" wouldn't mean what an admin reasonably expects. Their recipes and
 * data are untouched — this revokes access, it doesn't delete an account.
 */
export async function disallowGoogleEmail(email: string) {
  await requireAdmin();
  const parsed = listInviteEmailSchema.parse(email);

  await prisma.allowedEmail.deleteMany({ where: { email: parsed } });

  const user = await prisma.user.findFirst({
    where: { email: { equals: parsed, mode: "insensitive" } },
    select: { id: true },
  });
  if (user) await revokeOtherSessions(user.id, null);

  revalidatePath("/admin/users");
  return { email: parsed, signedOut: user !== null };
}

// --- Password accounts ------------------------------------------------------
//
// There is no self-registration: an admin creates the account and hands over a
// starting password, which the person is then made to replace on first sign-in
// (`mustChangePassword`). That keeps the app closed by default — the same
// posture as AUTH_ALLOWED_EMAILS on the Google path — and means no admin is
// left knowing a password anyone still uses.

/**
 * Create a password account. Admin-only, and only when password sign-in is
 * enabled for this deployment.
 *
 * The identifier is a username or an email depending on
 * `AUTH_PASSWORD_IDENTIFIER`, and is stored in the matching column so both
 * sign-in and list sharing can find the person afterwards.
 */
export async function createUserAccount(input: {
  identifier: string;
  password: string;
  name?: string;
  role?: "ADMIN" | "USER";
}) {
  await requireAdmin();
  assertPasswordAuthEnabled();

  const useEmail = passwordIdentifier() === "email";
  const identifier = useEmail
    ? listInviteEmailSchema.parse(input.identifier)
    : usernameSchema.parse(input.identifier);
  const password = newPasswordSchema.parse(input.password);
  const role = roleSchema.parse(input.role ?? "USER");
  const name = input.name?.trim() || null;

  const existing = await prisma.user.findFirst({
    where: useEmail
      ? { email: { equals: identifier, mode: "insensitive" } }
      : { username: identifier },
    select: { id: true },
  });
  if (existing) throw new Error("That account already exists.");

  const user = await prisma.user.create({
    data: {
      ...(useEmail ? { email: identifier } : { username: identifier }),
      name: name ?? identifier,
      role,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    },
    select: { id: true },
  });

  revalidatePath("/admin/users");
  return { id: user.id, identifier };
}

/**
 * Set a new starting password for someone who forgot theirs. Admin-only.
 *
 * Flags the account for a forced change and drops all of its sessions, so the
 * temporary password can't outlive the reset and anyone already signed in as
 * them is turned out.
 */
export async function resetUserPassword(userId: string, password: string) {
  await requireAdmin();
  assertPasswordAuthEnabled();
  const parsed = newPasswordSchema.parse(password);

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, passwordHash: true },
  });
  if (!target) throw new Error("User not found.");
  if (!target.username && !target.passwordHash) {
    throw new Error("That account signs in with Google — there is no password to reset.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(parsed),
      mustChangePassword: true,
    },
  });
  await revokeOtherSessions(userId, null);

  revalidatePath("/admin/users");
  return { ok: true };
}
