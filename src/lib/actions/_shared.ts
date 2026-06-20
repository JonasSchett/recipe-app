import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth-guards";
import type { IngredientInput } from "@/lib/validations";

// NOTE: not a "use server" module — these are internal helpers shared by the
// action files, not Server Actions themselves.

/** Throws unless the user is an admin or the recipe's author. */
export function assertCanModifyRecipe(
  user: SessionUser,
  recipe: { authorId: string },
): void {
  if (user.role !== "ADMIN" && recipe.authorId !== user.id) {
    throw new Error("Forbidden: you can only modify your own recipes.");
  }
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Resolve a list of tag names to ids, creating any that don't yet exist
 * (matched case-insensitively). Duplicates within the input are collapsed.
 */
export async function resolveTagIds(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = normalizeName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = await tx.tag.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    const tag = existing ?? (await tx.tag.create({ data: { name } }));
    ids.push(tag.id);
  }
  return ids;
}

export type ResolvedIngredient = {
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
};

/**
 * Resolve ingredient lines to join-row data, creating ingredients that don't
 * yet exist (matched case-insensitively). Duplicate ingredients are collapsed
 * (the composite primary key forbids the same ingredient twice on a recipe).
 */
export async function resolveIngredients(
  tx: Prisma.TransactionClient,
  inputs: IngredientInput[],
): Promise<ResolvedIngredient[]> {
  const rows: ResolvedIngredient[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const name = normalizeName(input.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = await tx.ingredient.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    const ingredient = existing ?? (await tx.ingredient.create({ data: { name } }));
    rows.push({
      ingredientId: ingredient.id,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
    });
  }
  return rows;
}
