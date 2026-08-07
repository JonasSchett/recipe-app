"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { userSettingsSchema, type UserSettingsInput } from "@/lib/validations";

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
