import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/** Parse a comma-separated env list of emails into lowercased, trimmed entries. */
function parseEmailList(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? []
  );
}

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
    // Optional access control: if AUTH_ALLOWED_EMAILS is set (comma-separated),
    // only those Google accounts may sign in. Empty/unset = anyone who passes
    // Google sign-in is allowed. (The dev sign-in path bypasses this.)
    signIn({ user }) {
      const allowed = parseEmailList(process.env.AUTH_ALLOWED_EMAILS);
      if (allowed.length === 0) return true;
      return !!user.email && allowed.includes(user.email.toLowerCase());
    },
    // Expose the user id and role on the session for authorization checks.
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
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
    },
  },
});
