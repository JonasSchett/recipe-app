"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import {
  recipeInputSchema,
  visibilitySchema,
  type RecipeInput,
} from "@/lib/validations";
import {
  assertCanModifyRecipe,
  resolveIngredients,
  resolveTagIds,
} from "@/lib/actions/_shared";
import { deleteRecipeImage } from "@/lib/storage";

/** Create a recipe owned by the current user. */
export async function createRecipe(input: RecipeInput) {
  const user = await requireUser();
  const data = recipeInputSchema.parse(input);

  const recipe = await prisma.$transaction(async (tx) => {
    const tagIds = await resolveTagIds(tx, data.tags);
    const ingredients = await resolveIngredients(tx, data.ingredients);
    return tx.recipe.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        instructions: data.instructions,
        imagePath: data.imagePath ?? null,
        visibility: data.visibility,
        authorId: user.id,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        ingredients: { create: ingredients },
      },
      select: { id: true },
    });
  });

  revalidatePath("/");
  return { id: recipe.id };
}

/** Update a recipe; allowed for its author or an admin. */
export async function updateRecipe(id: string, input: RecipeInput) {
  const user = await requireUser();
  const data = recipeInputSchema.parse(input);

  const existing = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true, authorId: true, imagePath: true },
  });
  if (!existing) throw new Error("Recipe not found.");
  assertCanModifyRecipe(user, existing);

  await prisma.$transaction(async (tx) => {
    const tagIds = await resolveTagIds(tx, data.tags);
    const ingredients = await resolveIngredients(tx, data.ingredients);
    // Replace the join rows wholesale, then update the scalar fields.
    await tx.recipeTag.deleteMany({ where: { recipeId: id } });
    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
    await tx.recipe.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
        instructions: data.instructions,
        imagePath: data.imagePath ?? null,
        visibility: data.visibility,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        ingredients: { create: ingredients },
      },
    });
  });

  // After the DB update succeeds, remove the previous image if it was replaced
  // or cleared (file deletion can't participate in the transaction).
  const newImagePath = data.imagePath ?? null;
  if (existing.imagePath && existing.imagePath !== newImagePath) {
    await deleteRecipeImage(existing.imagePath);
  }

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  return { id };
}

/** Delete a recipe; allowed for its author or an admin. Joins cascade. */
export async function deleteRecipe(id: string) {
  const user = await requireUser();
  const existing = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true, authorId: true, imagePath: true },
  });
  if (!existing) throw new Error("Recipe not found.");
  assertCanModifyRecipe(user, existing);

  await prisma.recipe.delete({ where: { id } });
  await deleteRecipeImage(existing.imagePath);
  revalidatePath("/");
  return { id };
}

/** Toggle a recipe between PRIVATE and PUBLIC; author or admin only. */
export async function setRecipeVisibility(
  id: string,
  visibility: "PRIVATE" | "PUBLIC",
) {
  const user = await requireUser();
  const parsed = visibilitySchema.parse(visibility);

  const existing = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!existing) throw new Error("Recipe not found.");
  assertCanModifyRecipe(user, existing);

  await prisma.recipe.update({ where: { id }, data: { visibility: parsed } });
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  return { id, visibility: parsed };
}
