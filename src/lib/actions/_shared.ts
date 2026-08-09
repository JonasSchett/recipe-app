import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth-guards";
import type { IngredientInput } from "@/lib/validations";
import {
  localeOf,
  normalizeTerm,
  translateTerm,
  type Domain,
} from "@/lib/i18n/translate";

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
//
// Ingredients and tags run this identical algorithm over two different pairs of
// tables, so it lives here once and `storeFor` supplies the three operations
// that actually differ. Step 2 is the subtle part, and a fix to it has to reach
// both domains — which it can only do if there is one copy of it.
// ---------------------------------------------------------------------------

/** The per-domain table operations `resolveEntityId` needs. */
type EntityStore = {
  /** The entity a surface form already maps to, or null. */
  findByAlias(normalized: string): Promise<string | null>;
  /** Record a surface form. First writer wins — never re-point an existing one. */
  addAlias(entityId: string, name: string, locale: string): Promise<void>;
  /** Create the entity under its English canonical name. */
  create(englishName: string): Promise<string>;
};

function storeFor(tx: Prisma.TransactionClient, domain: Domain): EntityStore {
  if (domain === "ingredient") {
    return {
      async findByAlias(normalized) {
        const row = await tx.ingredientName.findUnique({ where: { normalized } });
        return row?.ingredientId ?? null;
      },
      async addAlias(ingredientId, name, locale) {
        const normalized = normalizeTerm(name);
        if (!normalized) return;
        await tx.ingredientName.upsert({
          where: { normalized },
          update: {},
          create: { ingredientId, name: normalizeName(name), normalized, locale },
        });
      },
      async create(englishName) {
        const { id } = await tx.ingredient.create({ data: { name: englishName } });
        return id;
      },
    };
  }
  return {
    async findByAlias(normalized) {
      const row = await tx.tagName.findUnique({ where: { normalized } });
      return row?.tagId ?? null;
    },
    async addAlias(tagId, name, locale) {
      const normalized = normalizeTerm(name);
      if (!normalized) return;
      await tx.tagName.upsert({
        where: { normalized },
        update: {},
        create: { tagId, name: normalizeName(name), normalized, locale },
      });
    },
    async create(englishName) {
      const { id } = await tx.tag.create({ data: { name: englishName } });
      return id;
    },
  };
}

/** Resolve one typed surface form to its canonical entity id, creating as needed. */
async function resolveEntityId(
  store: EntityStore,
  domain: Domain,
  display: string,
): Promise<string> {
  const direct = await store.findByAlias(normalizeTerm(display));
  if (direct) return direct;

  const translation = translateTerm(domain, display);
  const englishName = translation ? translation.en : display;

  let entityId = await store.findByAlias(normalizeTerm(englishName));
  if (!entityId) {
    entityId = await store.create(englishName);
    await store.addAlias(entityId, englishName, "en");
  }

  await store.addAlias(
    entityId,
    display,
    translation ? localeOf(display, translation) : "und",
  );
  if (translation) await store.addAlias(entityId, translation.de, "de");
  return entityId;
}

/**
 * Resolve a batch of typed names to entity ids, dropping blanks and collapsing
 * inputs that land on the same entity — the recipe join tables have a composite
 * PK, so the same entity twice on one recipe is forbidden.
 */
async function resolveAll<T>(
  tx: Prisma.TransactionClient,
  domain: Domain,
  inputs: T[],
  nameOf: (input: T) => string,
): Promise<{ entityId: string; displayName: string; input: T }[]> {
  const store = storeFor(tx, domain);
  const rows: { entityId: string; displayName: string; input: T }[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const displayName = normalizeName(nameOf(input));
    if (!displayName) continue;
    const entityId = await resolveEntityId(store, domain, displayName);
    if (seen.has(entityId)) continue;
    seen.add(entityId);
    rows.push({ entityId, displayName, input });
  }
  return rows;
}

export type ResolvedTag = { tagId: string; displayName: string };

/**
 * Resolve tag names (any language) to canonical tag ids plus the surface form
 * to store on the recipe.
 */
export async function resolveTags(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<ResolvedTag[]> {
  const resolved = await resolveAll(tx, "tag", names, (name) => name);
  return resolved.map(({ entityId, displayName }) => ({
    tagId: entityId,
    displayName,
  }));
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
 */
export async function resolveIngredients(
  tx: Prisma.TransactionClient,
  inputs: IngredientInput[],
): Promise<ResolvedIngredient[]> {
  const resolved = await resolveAll(tx, "ingredient", inputs, (i) => i.name);
  return resolved.map(({ entityId, displayName, input }) => ({
    ingredientId: entityId,
    displayName,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
  }));
}
