import { prisma } from "@/lib/prisma";

// NOTE: not a "use server" module. Called from the NextAuth `signIn` event in
// `src/auth.ts` (and `dev-auth.ts`), never from the client.

/**
 * Turn any family-group invites addressed to `email` into memberships — the
 * group counterpart of `consumePendingListInvites`, run from the same hooks.
 * Idempotent, and never throws: a failure here must not stop a sign-in.
 */
export async function consumePendingGroupInvites(
  userId: string,
  email: string | null | undefined,
): Promise<number> {
  const address = email?.trim().toLowerCase();
  if (!address) return 0;

  try {
    const invites = await prisma.familyGroupInvite.findMany({
      where: { email: address },
      select: { id: true, groupId: true },
    });
    for (const invite of invites) {
      await prisma.familyGroupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId } },
        create: { groupId: invite.groupId, userId },
        update: {},
      });
      await prisma.familyGroupInvite.delete({ where: { id: invite.id } });
    }
    return invites.length;
  } catch (error) {
    console.error("Failed to consume group invites for", address, error);
    return 0;
  }
}
