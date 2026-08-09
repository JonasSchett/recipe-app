"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { tagNameSchema } from "@/lib/validations";
import { resolveTags } from "@/lib/actions/_shared";

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

/**
 * Create a tag by name in any language, reusing the existing entity when the
 * name (or its translation) is already known. Goes through `resolveTags` so the
 * localized alias rows get written too — otherwise the tag would be invisible
 * to cross-lingual search and to the autocomplete.
 */
export async function createTag(name: string) {
  await requireUser();
  const parsed = tagNameSchema.parse(name);
  const [resolved] = await prisma.$transaction((tx) => resolveTags(tx, [parsed]));
  const tag = await prisma.tag.findUniqueOrThrow({ where: { id: resolved.tagId } });
  revalidatePath("/tags");
  return tag;
}
