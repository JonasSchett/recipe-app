"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-guards";
import { tagNameSchema } from "@/lib/validations";

/** Mark a tag as "hearted" for the current user (for dashboard sections). */
export async function heartTag(tagId: string) {
  const user = await requireUser();
  await prisma.userHeartedTag.upsert({
    where: { userId_tagId: { userId: user.id, tagId } },
    create: { userId: user.id, tagId },
    update: {},
  });
  revalidatePath("/");
  return { tagId, hearted: true };
}

/** Remove a hearted tag for the current user. */
export async function unheartTag(tagId: string) {
  const user = await requireUser();
  await prisma.userHeartedTag.deleteMany({ where: { userId: user.id, tagId } });
  revalidatePath("/");
  return { tagId, hearted: false };
}

/** Create a tag by name, reusing an existing one (case-insensitive). */
export async function createTag(name: string) {
  await requireUser();
  const parsed = tagNameSchema.parse(name);
  const existing = await prisma.tag.findFirst({
    where: { name: { equals: parsed, mode: "insensitive" } },
  });
  const tag = existing ?? (await prisma.tag.create({ data: { name: parsed } }));
  revalidatePath("/tags");
  return tag;
}

/** Rename a tag (admin only). */
export async function renameTag(id: string, name: string) {
  await requireAdmin();
  const parsed = tagNameSchema.parse(name);
  const tag = await prisma.tag.update({ where: { id }, data: { name: parsed } });
  revalidatePath("/tags");
  return tag;
}

/** Delete a tag (admin only). Recipe links cascade. */
export async function deleteTag(id: string) {
  await requireAdmin();
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/tags");
  revalidatePath("/");
  return { id };
}
