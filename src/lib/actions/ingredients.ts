"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-guards";
import { ingredientNameSchema } from "@/lib/validations";

/** Create an ingredient by name, reusing an existing one (case-insensitive). */
export async function createIngredient(name: string) {
  await requireUser();
  const parsed = ingredientNameSchema.parse(name);
  const existing = await prisma.ingredient.findFirst({
    where: { name: { equals: parsed, mode: "insensitive" } },
  });
  const ingredient =
    existing ?? (await prisma.ingredient.create({ data: { name: parsed } }));
  revalidatePath("/ingredients");
  return ingredient;
}

/** Rename an ingredient (admin only). */
export async function renameIngredient(id: string, name: string) {
  await requireAdmin();
  const parsed = ingredientNameSchema.parse(name);
  const ingredient = await prisma.ingredient.update({
    where: { id },
    data: { name: parsed },
  });
  revalidatePath("/ingredients");
  return ingredient;
}

/** Delete an ingredient (admin only). Recipe links cascade. */
export async function deleteIngredient(id: string) {
  await requireAdmin();
  await prisma.ingredient.delete({ where: { id } });
  revalidatePath("/ingredients");
  revalidatePath("/");
  return { id };
}
