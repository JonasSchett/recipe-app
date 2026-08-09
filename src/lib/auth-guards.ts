import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  role: "ADMIN" | "USER";
  /** True while an admin-set password is still in place; see requireUser. */
  mustChangePassword: boolean;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/** Where a user with a pending password change is sent. */
export const CHANGE_PASSWORD_PATH = "/change-password";

/** Returns the signed-in user, or `null` when there is no session. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/**
 * Returns the signed-in user or throws when unauthenticated.
 *
 * Also refuses while `mustChangePassword` is set. Every query and mutation
 * funnels through here, so that one check is what makes the forced change
 * real: a user carrying an admin-set password can hold a valid session and
 * still do nothing with it but change that password. Redirecting in the page
 * would only hide the UI — Server Actions are HTTP endpoints and can be called
 * without ever loading it.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: you must be signed in.");
  if (user.mustChangePassword) {
    throw new Error("You must choose a new password before continuing.");
  }
  return user;
}

/**
 * Like `requireUser`, but tolerates a pending password change — for the change
 * password action itself, which would otherwise be the one thing the user is
 * required to do and forbidden from doing.
 */
export async function requireUserPendingPasswordChange(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: you must be signed in.");
  return user;
}

/** Returns the signed-in user or throws unless they are an admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Forbidden: admin access required.");
  return user;
}

/**
 * Page-level guard: the signed-in user, or a redirect. Replaces the
 * `getCurrentUser()` + `if (!user) redirect("/login")` pair every protected
 * page used to repeat, and adds the password-change detour in one place.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  return user;
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}
