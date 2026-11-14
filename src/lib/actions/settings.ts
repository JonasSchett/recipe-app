"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import {
  groupDefaultsSchema,
  userSettingsSchema,
  type GroupDefaultsInput,
  type UserSettingsInput,
} from "@/lib/validations";

/**
 * Update the current user's settings. Always writes the caller's own row —
 * there is no user id parameter, so this can't be aimed at anyone else.
 *
 * Fields are optional; omitted ones are left as they are.
 */
export async function updateUserSettings(input: UserSettingsInput) {
  const user = await requireUser();
  const data = userSettingsSchema.parse(input);

  await prisma.user.update({ where: { id: user.id }, data });

  revalidatePath("/account");
  // The create form pre-fills from these, so it must re-render too.
  revalidatePath("/recipes/new");
  return { ok: true };
}

/**
 * Update the current user's sharing defaults for one group they belong to.
 * Writes only the caller's own membership row; not being in the group reads as
 * "not found", like everywhere else groups are concerned.
 */
export async function updateGroupSharingDefaults(
  groupId: string,
  input: GroupDefaultsInput,
) {
  const user = await requireUser();
  const data = groupDefaultsSchema.parse(input);

  const { count } = await prisma.familyGroupMember.updateMany({
    where: { groupId, userId: user.id },
    data,
  });
  if (count === 0) throw new Error("Group not found.");

  revalidatePath("/account");
  revalidatePath("/recipes/new");
  return { ok: true };
}
