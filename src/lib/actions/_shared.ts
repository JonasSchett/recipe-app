import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth-guards";
import type { IngredientInput } from "@/lib/validations";
import { localeOf, normalizeTerm, translateTerm } from "@/lib/i18n/translate";

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

/** Trim + collapse whitespace, preserving casing (this is the display form). */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Multilingual entity resolution.
//
// Ingredients and tags are unified across languages: each entity's `name` is
// the English canonical, and localized surface forms (IngredientName/TagName)
// all point back to it. Resolving a typed term:
//   1. exact alias hit (any language) -> that entity
//   2. else translate to English (curated dictionary), find/create the entity
//      by its English alias, and record the typed form + en/de aliases
// so that future lookups (and cross-lingual search) hit instantly.
// ---------------------------------------------------------------------------

async function addIngredientAlias(
  tx: Prisma.TransactionClient,
  ingredientId: string,
  name: string,
  locale: string,
): Promise<void> {
  const normalized = normalizeTerm(name);
  if (!normalized) return;
  // First writer wins — never re-point an existing surface form to another entity.
  await tx.ingredientName.upsert({
    where: { normalized },
    update: {},
    create: { ingredientId, name: normalizeName(name), normalized, locale },
  });
}

async function resolveIngredientId(
  tx: Prisma.TransactionClient,
  display: string,
): Promise<string> {
  const direct = await tx.ingredientName.findUnique({
    where: { normalized: normalizeTerm(display) },
  });
  if (direct) return direct.ingredientId;

  const translation = translateTerm("ingredient", display);
  const englishName = translation ? translation.en : display;

  const enAlias = await tx.ingredientName.findUnique({
    where: { normalized: normalizeTerm(englishName) },
  });

  let ingredientId: string;
  if (enAlias) {
    ingredientId = enAlias.ingredientId;
  } else {
    const created = await tx.ingredient.create({ data: { name: englishName } });
    ingredientId = created.id;
    await addIngredientAlias(tx, ingredientId, englishName, "en");
  }

  await addIngredientAlias(
    tx,
    ingredientId,
    display,
    translation ? localeOf(display, translation) : "und",
  );
  if (translation) {
    await addIngredientAlias(tx, ingredientId, translation.de, "de");
  }
  return ingredientId;
}

async function addTagAlias(
  tx: Prisma.TransactionClient,
  tagId: string,
  name: string,
  locale: string,
): Promise<void> {
  const normalized = normalizeTerm(name);
  if (!normalized) return;
  await tx.tagName.upsert({
    where: { normalized },
    update: {},
    create: { tagId, name: normalizeName(name), normalized, locale },
  });
}

async function resolveTagId(
  tx: Prisma.TransactionClient,
  display: string,
): Promise<string> {
  const direct = await tx.tagName.findUnique({
    where: { normalized: normalizeTerm(display) },
  });
  if (direct) return direct.tagId;

  const translation = translateTerm("tag", display);
  const englishName = translation ? translation.en : display;

  const enAlias = await tx.tagName.findUnique({
    where: { normalized: normalizeTerm(englishName) },
  });

  let tagId: string;
  if (enAlias) {
    tagId = enAlias.tagId;
  } else {
    const created = await tx.tag.create({ data: { name: englishName } });
    tagId = created.id;
    await addTagAlias(tx, tagId, englishName, "en");
  }

  await addTagAlias(
    tx,
    tagId,
    display,
    translation ? localeOf(display, translation) : "und",
  );
  if (translation) {
    await addTagAlias(tx, tagId, translation.de, "de");
  }
  return tagId;
}

export type ResolvedTag = { tagId: string; displayName: string };

/**
 * Resolve tag names (any language) to canonical tag ids plus the surface form
 * to store on the recipe. Duplicates (same entity) are collapsed.
 */
export async function resolveTags(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<ResolvedTag[]> {
  const rows: ResolvedTag[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const display = normalizeName(raw);
    if (!display) continue;
    const tagId = await resolveTagId(tx, display);
    if (seen.has(tagId)) continue;
    seen.add(tagId);
    rows.push({ tagId, displayName: display });
  }
  return rows;
}

export type ResolvedIngredient = {
  ingredientId: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
};

/**
 * Resolve ingredient lines (any language) to join-row data, unifying to the
 * canonical entity and keeping the typed surface form as `displayName`.
 * Duplicate ingredients are collapsed (the composite PK forbids the same
 * ingredient twice on a recipe).
 */
export async function resolveIngredients(
  tx: Prisma.TransactionClient,
  inputs: IngredientInput[],
): Promise<ResolvedIngredient[]> {
  const rows: ResolvedIngredient[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const display = normalizeName(input.name);
    if (!display) continue;
    const ingredientId = await resolveIngredientId(tx, display);
    if (seen.has(ingredientId)) continue;
    seen.add(ingredientId);
    rows.push({
      ingredientId,
      displayName: display,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
    });
  }
  return rows;
}
