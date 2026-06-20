import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  role: "ADMIN" | "USER";
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/** Returns the signed-in user, or `null` when there is no session. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** Returns the signed-in user or throws when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
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

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}
