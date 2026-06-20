"use server";

import { requireUser } from "@/lib/auth-guards";
import { deleteRecipeImage, saveRecipeImage } from "@/lib/storage";

/**
 * Upload a recipe image. Returns the public path to pass to
 * `createRecipe` / `updateRecipe` as `imagePath`.
 *
 * Expects a `FormData` with an `image` File field.
 */
export async function uploadRecipeImage(formData: FormData) {
  await requireUser();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    throw new Error("No image file provided.");
  }
  const path = await saveRecipeImage(file);
  return { path };
}

/**
 * Discard an uploaded image that is not (or no longer) attached to a saved
 * recipe — e.g. when the user removes the image before submitting, or cancels.
 */
export async function discardRecipeImage(publicPath: string) {
  await requireUser();
  await deleteRecipeImage(publicPath);
  return { ok: true };
}
