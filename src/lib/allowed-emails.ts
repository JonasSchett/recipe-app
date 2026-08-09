import { prisma } from "@/lib/prisma";

// Who may sign in with Google.
//
// The effective allowlist is `AUTH_ALLOWED_EMAILS` **plus** the `AllowedEmail`
// table, so an admin can let someone in from the app without an .env edit and a
// container restart, while the env var keeps working as the bootstrap — you
// cannot lock yourself out by deleting the last row.
//
// Both empty means no restriction at all, which is exactly what the app did
// before this table existed. That is deliberate: adding the feature must not
// silently lock an existing deployment out of its own instance.
//
// Google only. Password accounts are created by an admin, so they are already
// closed by construction, and the dev sign-in bypasses NextAuth entirely.

/** Parse a comma-separated env list of emails into lowercased, trimmed entries. */
export function parseEmailList(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? []
  );
}

/** Addresses allowed via `AUTH_ALLOWED_EMAILS`. Not editable from the app. */
export function envAllowedEmails(): string[] {
  return parseEmailList(process.env.AUTH_ALLOWED_EMAILS);
}

/** True when nothing anywhere restricts sign-in, so anyone with Google gets in. */
async function gateIsOpen(envList: string[]): Promise<boolean> {
  if (envList.length > 0) return false;
  return (await prisma.allowedEmail.count()) === 0;
}

/**
 * Whether `email` may sign in with Google.
 *
 * Called from the NextAuth `signIn` callback, which runs *before* the adapter
 * creates anything — a rejected sign-in leaves no `User` row behind.
 */
export async function isGoogleEmailAllowed(
  email: string | null | undefined,
): Promise<boolean> {
  const address = email?.trim().toLowerCase();
  const envList = envAllowedEmails();

  if (!address) return gateIsOpen(envList);
  if (envList.includes(address)) return true;

  const listed = await prisma.allowedEmail.findUnique({
    where: { email: address },
    select: { id: true },
  });
  if (listed) return true;

  return gateIsOpen(envList);
}
