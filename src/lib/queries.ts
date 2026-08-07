import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  requireAdmin,
  requireUser,
  type SessionUser,
} from "@/lib/auth-guards";
import { recipeFilterSchema, type RecipeFilter } from "@/lib/validations";
import {
  INGREDIENT_TRANSLATIONS,
  TAG_TRANSLATIONS,
} from "@/lib/i18n/dictionary";
import { withDictionary, type EntitySuggestion } from "@/lib/suggest";
import { searchRecipeIds } from "@/lib/recipe-search";

/**
 * Prisma `where` fragment restricting recipes to those a user may view:
 * admins see everything; everyone else sees PUBLIC recipes plus their own.
 */
export function visibilityWhere(user: SessionUser): Prisma.RecipeWhereInput {
  if (user.role === "ADMIN") return {};
  return { OR: [{ visibility: "PUBLIC" }, { authorId: user.id }] };
}

/** Include shape returning a recipe with its author, ingredients, and tags. */
const recipeDetailInclude = {
  author: { select: { id: true, name: true, email: true, image: true } },
  images: { orderBy: { position: "asc" } },
  ingredients: { include: { ingredient: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.RecipeInclude;

export type RecipeDetail = Prisma.RecipeGetPayload<{
  include: typeof recipeDetailInclude;
}>;

/**
 * Paginated list of recipes the current user may view, optionally narrowed by
 * search text and by tags/ingredients (AND across every selection).
 *
 * Search is fuzzy (see `lib/recipe-search.ts`): it matches the title,
 * description and instructions plus any localized tag/ingredient alias, and
 * tolerates typos and missing umlauts. A search is ordered by relevance;
 * without one the list stays alphabetical.
 */
export async function getRecipes(filter: Partial<RecipeFilter> = {}) {
  const user = await requireUser();
  const { search, tagIds, ingredientIds, page, pageSize } =
    recipeFilterSchema.parse(filter);

  // The fuzzy pass runs first and yields ranked ids, which then act as one more
  // filter here — so visibility and the tag/ingredient selections still decide
  // what is actually returned.
  const ranked = search ? await searchRecipeIds(search) : null;

  const where: Prisma.RecipeWhereInput = {
    AND: [
      visibilityWhere(user),
      ...(ranked ? [{ id: { in: ranked.map((row) => row.id) } }] : []),
      ...tagIds.map((tagId) => ({ tags: { some: { tagId } } })),
      ...ingredientIds.map((ingredientId) => ({ ingredients: { some: { ingredientId } } })),
    ],
  };

  // Relevance order can't be expressed in SQL here (it lives in the ranked id
  // list), so a search fetches its matches — capped by the search's own
  // candidate limit — and pages them in memory.
  if (ranked) {
    const rankOf = new Map(ranked.map((row, index) => [row.id, index]));
    const matches = await prisma.recipe.findMany({
      where,
      include: recipeDetailInclude,
    });
    matches.sort((a, b) => rankOf.get(a.id)! - rankOf.get(b.id)!);

    return {
      items: matches.slice((page - 1) * pageSize, page * pageSize),
      total: matches.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(matches.length / pageSize)),
    };
  }

  const [items, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      include: recipeDetailInclude,
      orderBy: { title: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.recipe.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** A single recipe by id, or `null` if it does not exist or is not visible. */
export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
  const user = await requireUser();
  const recipe = await prisma.recipe.findFirst({
    where: { AND: [{ id }, visibilityWhere(user)] },
    include: recipeDetailInclude,
  });
  return recipe;
}

/**
 * For the dashboard: one section per tag the current user has hearted, each
 * with up to `take` recipes (visible to them) carrying that tag.
 */
export async function getHeartedTagSections(take = 12) {
  const user = await requireUser();
  const hearted = await prisma.userHeartedTag.findMany({
    where: { userId: user.id },
    include: { tag: true },
    orderBy: { tag: { name: "asc" } },
  });

  return Promise.all(
    hearted.map(async ({ tag }) => ({
      tag,
      recipes: await prisma.recipe.findMany({
        where: { AND: [visibilityWhere(user), { tags: { some: { tagId: tag.id } } }] },
        include: recipeDetailInclude,
        orderBy: { updatedAt: "desc" },
        take,
      }),
    })),
  );
}

/**
 * For the Favourite Tags page: each tag the current user has hearted, with a
 * representative image — the first visible recipe carrying that tag that has
 * an image (`null` if none do).
 */
export async function getHeartedTagCards() {
  const user = await requireUser();
  const hearted = await prisma.userHeartedTag.findMany({
    where: { userId: user.id },
    include: { tag: true },
    orderBy: { tag: { name: "asc" } },
  });

  return Promise.all(
    hearted.map(async ({ tag }) => {
      const recipe = await prisma.recipe.findFirst({
        where: {
          AND: [
            visibilityWhere(user),
            { tags: { some: { tagId: tag.id } } },
            { images: { some: {} } },
          ],
        },
        select: {
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { path: true },
          },
        },
      });
      return { tag, imagePath: recipe?.images[0]?.path ?? null };
    }),
  );
}

/** All tags with recipe counts; flags which ones the current user has hearted. */
export async function getAllTags() {
  const user = await getCurrentUser();
  const [tags, hearted] = await Promise.all([
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { recipes: true } } },
    }),
    user
      ? prisma.userHeartedTag.findMany({
          where: { userId: user.id },
          select: { tagId: true },
        })
      : Promise.resolve([]),
  ]);
  const heartedIds = new Set(hearted.map((h) => h.tagId));
  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    recipeCount: tag._count.recipes,
    hearted: heartedIds.has(tag.id),
  }));
}

/** All users with their role and recipe count, for the admin console. */
export async function getAllUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      createdAt: true,
      _count: { select: { recipes: true } },
    },
  });
}

/**
 * Every ingredient and tag with **all** of its surface forms, for the
 * autocomplete. Loaded once per form/page render and filtered client-side —
 * the vocabulary is small (hundreds of rows) and this keeps typing latency at
 * zero. If it ever grows past a few thousand entities, swap the callers for a
 * debounced server-side search on `normalized` instead.
 *
 * Curated dictionary terms with no stored entity are appended (`id: null`) so
 * suggestions are useful on a fresh database too; they always rank last.
 * Tags and ingredients are global — no visibility filtering applies.
 */
export async function getEntityVocabulary(): Promise<{
  ingredients: EntitySuggestion[];
  tags: EntitySuggestion[];
}> {
  await requireUser();

  const include = {
    names: { select: { name: true } },
    _count: { select: { recipes: true } },
  } as const;

  const [ingredients, tags] = await Promise.all([
    prisma.ingredient.findMany({ include }),
    prisma.tag.findMany({ include }),
  ]);

  const toSuggestion = (
    entity: {
      id: string;
      name: string;
      names: { name: string }[];
      _count: { recipes: number };
    },
    kind: "tag" | "ingredient",
  ): EntitySuggestion => ({
    id: entity.id,
    canonical: entity.name,
    names: entity.names.map((n) => n.name),
    recipeCount: entity._count.recipes,
    kind,
  });

  return {
    ingredients: withDictionary(
      ingredients.map((i) => toSuggestion(i, "ingredient")),
      INGREDIENT_TRANSLATIONS,
      "ingredient",
    ),
    tags: withDictionary(
      tags.map((t) => toSuggestion(t, "tag")),
      TAG_TRANSLATIONS,
      "tag",
    ),
  };
}

/** All ingredients with recipe counts (alphabetical). */
export async function getAllIngredients() {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { recipes: true } } },
  });
  return ingredients.map((ingredient) => ({
    id: ingredient.id,
    name: ingredient.name,
    recipeCount: ingredient._count.recipes,
  }));
}
