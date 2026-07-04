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
  resolveTags,
} from "@/lib/actions/_shared";
import { deleteRecipeImage } from "@/lib/storage";

/** Create a recipe owned by the current user. */
export async function createRecipe(input: RecipeInput) {
  const user = await requireUser();
  const data = recipeInputSchema.parse(input);

  const recipe = await prisma.$transaction(async (tx) => {
    const tags = await resolveTags(tx, data.tags);
    const ingredients = await resolveIngredients(tx, data.ingredients);
    return tx.recipe.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        instructions: data.instructions ?? null,
        visibility: data.visibility,
        authorId: user.id,
        // Array order defines display order; index 0 is the hero image.
        images: {
          create: data.imagePaths.map((path, position) => ({ path, position })),
        },
        tags: {
          create: tags.map(({ tagId, displayName }) => ({ tagId, displayName })),
        },
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
    select: {
      id: true,
      authorId: true,
      images: { select: { path: true } },
    },
  });
  if (!existing) throw new Error("Recipe not found.");
  assertCanModifyRecipe(user, existing);

  await prisma.$transaction(async (tx) => {
    const tags = await resolveTags(tx, data.tags);
    const ingredients = await resolveIngredients(tx, data.ingredients);
    // Replace the join rows (and image rows) wholesale, then update scalars.
    await tx.recipeTag.deleteMany({ where: { recipeId: id } });
    await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
    await tx.recipeImage.deleteMany({ where: { recipeId: id } });
    await tx.recipe.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
        instructions: data.instructions ?? null,
        visibility: data.visibility,
        images: {
          create: data.imagePaths.map((path, position) => ({ path, position })),
        },
        tags: {
          create: tags.map(({ tagId, displayName }) => ({ tagId, displayName })),
        },
        ingredients: { create: ingredients },
      },
    });
  });

  // After the DB update succeeds, remove files for images that are no longer
  // referenced (file deletion can't participate in the transaction).
  const keptPaths = new Set(data.imagePaths);
  await Promise.all(
    existing.images
      .filter((img) => !keptPaths.has(img.path))
      .map((img) => deleteRecipeImage(img.path)),
  );

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  return { id };
}

/** Delete a recipe; allowed for its author or an admin. Joins cascade. */
export async function deleteRecipe(id: string) {
  const user = await requireUser();
  const existing = await prisma.recipe.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      images: { select: { path: true } },
    },
  });
  if (!existing) throw new Error("Recipe not found.");
  assertCanModifyRecipe(user, existing);

  await prisma.recipe.delete({ where: { id } });
  await Promise.all(existing.images.map((img) => deleteRecipeImage(img.path)));
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
