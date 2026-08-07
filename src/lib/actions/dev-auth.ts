"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { consumePendingListInvites } from "@/lib/list-invites";

/**
 * DEVELOPMENT-ONLY sign-in. Google OAuth requires external setup, so this lets
 * you sign in locally as a test user. It creates a real database Session row and
 * sets the Auth.js session cookie, so the rest of the app treats it like any
 * normal session. Hard-disabled when NODE_ENV === "production".
 */
export async function devSignIn(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev sign-in is disabled in production.");
  }

  const email = (formData.get("email") as string)?.trim() || "dev@local.test";
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";

  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, name: email.split("@")[0], role },
  });

  // The real sign-in settles pending list invites in the NextAuth `signIn`
  // event, which this path never reaches — do the same here so dev behaves
  // like production.
  await consumePendingListInvites(user.id, user.email);

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  // Non-secure cookie name (we're on http://localhost in dev).
  const store = await cookies();
  store.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  redirect("/recipes");
}
