import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Issuing a database session by hand, for the sign-in paths that don't go
// through NextAuth (password sign-in, and the dev-only sign-in).
//
// This works precisely because the app uses `session: { strategy: "database" }`
// — a session is just a `Session` row plus a cookie holding its token, so
// writing both is a complete, ordinary login that `auth()` reads like any
// other. It is also why password sign-in doesn't use Auth.js's Credentials
// provider, which supports the JWT strategy only.

const SESSION_DAYS = 30;

/**
 * The cookie name Auth.js will look for. It prefixes `__Secure-` when the
 * deployment is served over https, so this mirrors that rule exactly (see
 * `defaultCookies` in @auth/core) — get it wrong and the cookie is set but
 * every request still reads as signed out.
 */
export function sessionCookieName(): string {
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const secure = url.startsWith("https:");
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

/**
 * Create a session for `userId` and set its cookie. The caller is responsible
 * for having authenticated the user first — this function asks no questions.
 */
export async function startSession(userId: string): Promise<void> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { sessionToken, userId, expires } });

  const store = await cookies();
  store.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: sessionCookieName().startsWith("__Secure-"),
    expires,
  });
}

/**
 * Drop every other session belonging to a user. Called after a password
 * change so a stolen or shared password stops working everywhere at once,
 * which is the main thing a password change is for.
 */
export async function revokeOtherSessions(
  userId: string,
  keepToken: string | null,
): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(keepToken ? { sessionToken: { not: keepToken } } : {}),
    },
  });
}

/** The current request's session token, if it has one. */
export async function currentSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(sessionCookieName())?.value ?? null;
}
