"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserPendingPasswordChange } from "@/lib/auth-guards";
import { assertPasswordAuthEnabled, passwordIdentifier } from "@/lib/auth-methods";
import { fakeVerifyDelay, hashPassword, verifyPassword } from "@/lib/password";
import {
  currentSessionToken,
  revokeOtherSessions,
  startSession,
} from "@/lib/session-cookie";
import {
  listInviteEmailSchema,
  newPasswordSchema,
  signInIdentifierSchema,
  usernameSchema,
} from "@/lib/validations";

/** Deliberately identical for "no such account" and "wrong password". */
const BAD_CREDENTIALS = "Incorrect username or password.";

/**
 * Sign in with an identifier + password, issuing an ordinary database session.
 *
 * Accounts are created by an admin (see `createUserAccount`), so there is no
 * registration path here and a failed attempt reveals nothing: the same
 * message covers a missing account and a wrong password, and a miss still
 * burns a comparable amount of time so the two can't be told apart by timing.
 */
export async function signInWithPassword(formData: FormData) {
  assertPasswordAuthEnabled();

  const identifier = signInIdentifierSchema.safeParse(formData.get("identifier"));
  const password = String(formData.get("password") ?? "");

  if (!identifier.success || !password) {
    await fakeVerifyDelay();
    throw new Error(BAD_CREDENTIALS);
  }

  const value = identifier.data;
  const user = await prisma.user.findFirst({
    where:
      passwordIdentifier() === "email"
        ? { email: { equals: value, mode: "insensitive" } }
        : { username: value },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    await fakeVerifyDelay();
    throw new Error(BAD_CREDENTIALS);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new Error(BAD_CREDENTIALS);
  }

  await startSession(user.id);
  redirect("/recipes");
}

/**
 * First-run setup: create the very first account, as an admin, and sign in as
 * it. Unauthenticated by necessity — there is nobody to authorize against.
 *
 * Safe because it refuses the moment any user exists, and the check runs
 * server-side on every call, not just when the page decided to render the
 * form. With password auth on and an empty database this is the only way in:
 * `AUTH_ADMIN_EMAILS` promotes on the Google sign-in event, which a
 * password-only deployment never reaches.
 *
 * The password is the operator's own choice, so unlike an admin-issued one it
 * carries no forced change.
 */
export async function createFirstAdmin(formData: FormData) {
  assertPasswordAuthEnabled();

  if ((await prisma.user.count()) > 0) {
    throw new Error("Setup has already been completed.");
  }

  const useEmail = passwordIdentifier() === "email";
  const rawIdentifier = String(formData.get("identifier") ?? "");
  const identifier = useEmail
    ? listInviteEmailSchema.parse(rawIdentifier)
    : usernameSchema.parse(rawIdentifier);
  const password = newPasswordSchema.parse(formData.get("password"));
  if (password !== String(formData.get("confirmPassword") ?? "")) {
    throw new Error("The two passwords don't match.");
  }

  const user = await prisma.user.create({
    data: {
      ...(useEmail ? { email: identifier } : { username: identifier }),
      name: identifier,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
    },
    select: { id: true },
  });

  await startSession(user.id);
  redirect("/recipes");
}

/**
 * Change your own password. Requires the current one, except when an admin set
 * it and you are being made to replace it — you were handed that password, so
 * proving you know it establishes nothing.
 *
 * Every other session is dropped afterwards: whoever set the old password (or
 * learned it) should not keep a working session.
 */
export async function changeMyPassword(formData: FormData) {
  const user = await requireUserPendingPasswordChange();

  const current = String(formData.get("currentPassword") ?? "");
  const next = newPasswordSchema.safeParse(formData.get("newPassword"));
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!next.success) {
    throw new Error(next.error.issues[0]?.message ?? "That password is not valid.");
  }
  if (next.data !== confirm) {
    throw new Error("The two passwords don't match.");
  }

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true, mustChangePassword: true },
  });

  if (!row.passwordHash) {
    // A Google account has no password to change; giving it one here would
    // quietly create a second way into the account.
    throw new Error("This account signs in with Google and has no password.");
  }

  if (!row.mustChangePassword && !(await verifyPassword(current, row.passwordHash))) {
    throw new Error("Your current password is incorrect.");
  }

  if (await verifyPassword(next.data, row.passwordHash)) {
    throw new Error("That is already your password — pick a different one.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(next.data),
      mustChangePassword: false,
    },
  });

  await revokeOtherSessions(user.id, await currentSessionToken());
  return { ok: true };
}
