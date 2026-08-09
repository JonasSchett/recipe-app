import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { consumePendingListInvites } from "@/lib/list-invites";
import { isGoogleEmailAllowed, parseEmailList } from "@/lib/allowed-emails";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Optional access control over Google sign-in: AUTH_ALLOWED_EMAILS plus the
    // admin-managed AllowedEmail table. Both empty = anyone who passes Google.
    // See lib/allowed-emails.ts. (The dev sign-in path bypasses this.)
    signIn({ user }) {
      return isGoogleEmailAllowed(user.email);
    },
    // Expose the user id and role on the session for authorization checks.
    // Free with database sessions: the full user row is already loaded here.
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
        session.user.mustChangePassword = user.mustChangePassword;
      }
      return session;
    },
  },
  events: {
    // Bootstrap admins: anyone whose email is in AUTH_ADMIN_EMAILS is promoted
    // to ADMIN on sign-in. Idempotent and self-healing — the first time a listed
    // user signs in (the row exists by the time this event fires) they become an
    // admin, who can then promote others from the UI. Removing an email here
    // does NOT demote; do that from the admin page.
    async signIn({ user }) {
      const adminEmails = parseEmailList(process.env.AUTH_ADMIN_EMAILS);
      const email = user.email?.toLowerCase();
      if (email && adminEmails.includes(email)) {
        await prisma.user.updateMany({
          where: { email: user.email!, role: { not: "ADMIN" } },
          data: { role: "ADMIN" },
        });
      }
      // Settle any list shares sent to this address before they had an
      // account. Same hook, same guarantee: the user row exists by now.
      if (user.id) await consumePendingListInvites(user.id, user.email);
    },
  },
});
