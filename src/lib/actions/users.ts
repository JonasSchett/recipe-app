"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { roleSchema } from "@/lib/validations";

/**
 * Promote or demote a user. Admin-only. An admin cannot change their own role —
 * this prevents an admin from accidentally locking themselves out, and
 * guarantees at least one admin always remains (the actor).
 */
export async function setUserRole(userId: string, role: "ADMIN" | "USER") {
  const actor = await requireAdmin();
  const parsed = roleSchema.parse(role);

  if (userId === actor.id) {
    throw new Error("You can't change your own role.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!target) throw new Error("User not found.");

  await prisma.user.update({ where: { id: userId }, data: { role: parsed } });
  revalidatePath("/admin/users");
  return { id: userId, role: parsed };
}
