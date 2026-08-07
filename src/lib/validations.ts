import { z } from "zod";

/** A single ingredient line within a recipe form. */
export const ingredientInputSchema = z.object({
  name: z.string().trim().min(1, "Ingredient name is required").max(100),
  // Quantity is optional ("a pinch of salt" has none) and supports scaling later.
  quantity: z.number().positive().max(100000).nullish(),
  unit: z.string().trim().max(30).nullish(),
});

export type IngredientInput = z.infer<typeof ingredientInputSchema>;

export const visibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

export const roleSchema = z.enum(["ADMIN", "USER"]);

/** Payload for creating or editing a recipe. */
export const recipeInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).nullish(),
  // Optional: some recipes are just photos of a cookbook page plus tags.
  instructions: z.string().trim().max(20000).nullish(),
  visibility: visibilitySchema.default("PRIVATE"),
  // Images are uploaded separately (Phase 4); actions take resolved paths in
  // display order — index 0 is the hero image.
  imagePaths: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  ingredients: z.array(ingredientInputSchema).max(100).default([]),
  tags: z.array(z.string().trim().min(1).max(50)).max(50).default([]),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

/** Filters for the paginated "all recipes" list. */
export const recipeFilterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  // Multiple tags/ingredients narrow with AND semantics (must match all).
  tagIds: z.array(z.string()).max(50).default([]),
  ingredientIds: z.array(z.string()).max(50).default([]),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type RecipeFilter = z.infer<typeof recipeFilterSchema>;

/** Body of a personal recipe note. Empty means "delete the note". */
export const recipeNoteSchema = z.string().trim().max(5000);

/**
 * Per-user settings editable on /account. Every field is optional so a caller
 * can update one setting without restating the others.
 */
export const userSettingsSchema = z.object({
  defaultRecipeVisibility: visibilitySchema.optional(),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;

export const tagNameSchema = z.string().trim().min(1, "Tag name is required").max(50);
export const ingredientNameSchema = z
  .string()
  .trim()
  .min(1, "Ingredient name is required")
  .max(100);
