import { prisma } from "@/lib/prisma";

// NOTE: not a "use server" module. This is called from the NextAuth `signIn`
// event in `src/auth.ts`, not from the client.

/**
 * Turn any list invites addressed to `email` into real memberships.
 *
 * Runs on every sign-in, like the `AUTH_ADMIN_EMAILS` admin bootstrap next to
 * it, and for the same reason: the user row is guaranteed to exist by the time
 * the event fires, so a share sent before that person ever used the app can be
 * settled the moment they arrive. Idempotent — consumed invites are deleted,
 * and an existing membership is left alone rather than downgraded.
 *
 * Never throws: a failure here must not stop someone signing in.
 */
export async function consumePendingListInvites(
  userId: string,
  email: string | null | undefined,
): Promise<number> {
  const address = email?.trim().toLowerCase();
  if (!address) return 0;

  try {
    const invites = await prisma.recipeListInvite.findMany({
      where: { email: address },
      select: { id: true, listId: true, role: true, list: { select: { ownerId: true } } },
    });
    if (invites.length === 0) return 0;

    let joined = 0;
    for (const invite of invites) {
      // Someone could be invited to a list they went on to own (or already
      // own); an owner has no member row, so skip rather than create a
      // contradictory one.
      if (invite.list.ownerId !== userId) {
        await prisma.recipeListMember.upsert({
          where: { listId_userId: { listId: invite.listId, userId } },
          create: { listId: invite.listId, userId, role: invite.role },
          update: {},
        });
        joined += 1;
      }
      await prisma.recipeListInvite.delete({ where: { id: invite.id } });
    }
    return joined;
  } catch (error) {
    console.error("Failed to consume list invites for", address, error);
    return 0;
  }
}
