import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

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
      const allowed = process.env.AUTH_ALLOWED_EMAILS?.split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
      if (!allowed || allowed.length === 0) return true;
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
});
