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

// --- Password sign-in -------------------------------------------------------

/**
 * A login name. Lowercased on the way in so "Anna" and "anna" are one account —
 * the column is unique, and two accounts differing only in case would be a
 * standing invitation to impersonate someone.
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(32)
  .regex(
    /^[a-z0-9._-]+$/,
    "Use only letters, numbers, and . _ -",
  );

/**
 * What the sign-in form accepts. Deliberately loose — it is matched against the
 * database, not validated for shape, so a wrong guess fails as bad credentials
 * rather than as a format complaint that confirms what the right shape is.
 */
export const signInIdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(200);

/**
 * Minimum 10 characters and nothing else. Length beats composition rules for
 * real-world strength, and this is a self-hosted app for a household, not a
 * bank.
 */
export const newPasswordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(200, "Password must be at most 200 characters");

// --- Shared recipe lists ----------------------------------------------------

export const listRoleSchema = z.enum(["VIEWER", "EDITOR"]);

export const listNameSchema = z
  .string()
  .trim()
  .min(1, "List name is required")
  .max(80);

/** Email an existing or future user is invited by. Stored lowercased. */
export const listInviteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(200);

// --- Batch operations (declared last: they build on the schemas above) -------

/**
 * Most recipes one batch may touch. Bounds the work a single request can ask
 * for, and is also the ceiling "select all matching" fills to, so the UI can
 * never build a selection the actions would reject.
 */
export const BATCH_RECIPE_LIMIT = 200;

/** Recipes targeted by a batch operation. */
export const batchRecipeIdsSchema = z
  .array(z.string().min(1))
  .min(1, "Select at least one recipe")
  .max(BATCH_RECIPE_LIMIT);

/** Payload for adding tags to many recipes at once. */
export const batchTagsSchema = z.object({
  recipeIds: batchRecipeIdsSchema,
  tags: z.array(tagNameSchema).min(1, "Add at least one tag").max(50),
});

export type BatchTagsInput = z.infer<typeof batchTagsSchema>;

/** Payload for adding ingredients to many recipes at once. */
export const batchIngredientsSchema = z.object({
  recipeIds: batchRecipeIdsSchema,
  ingredients: z
    .array(ingredientInputSchema)
    .min(1, "Add at least one ingredient")
    .max(50),
});

export type BatchIngredientsInput = z.infer<typeof batchIngredientsSchema>;
