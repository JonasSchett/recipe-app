import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  requireAdmin,
  requireUser,
  type SessionUser,
} from "@/lib/auth-guards";
import { recipeFilterSchema, type RecipeFilter } from "@/lib/validations";

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
 * Paginated, alphabetical list of recipes the current user may view, optionally
 * narrowed by search text and by tags/ingredients (AND across every selection).
 */
export async function getRecipes(filter: Partial<RecipeFilter> = {}) {
  const user = await requireUser();
  const { search, tagIds, ingredientIds, page, pageSize } =
    recipeFilterSchema.parse(filter);

  const where: Prisma.RecipeWhereInput = {
    AND: [
      visibilityWhere(user),
      ...(search
        ? [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { description: { contains: search, mode: "insensitive" as const } },
                // Cross-lingual: match any localized ingredient/tag alias. Since
                // each entity carries both its English and German names,
                // searching "Onion" finds a recipe that stored "Zwiebel".
                {
                  ingredients: {
                    some: {
                      ingredient: {
                        names: {
                          some: {
                            normalized: { contains: search.toLowerCase() },
                          },
                        },
                      },
                    },
                  },
                },
                {
                  tags: {
                    some: {
                      tag: {
                        names: {
                          some: {
                            normalized: { contains: search.toLowerCase() },
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ]
        : []),
      ...tagIds.map((tagId) => ({ tags: { some: { tagId } } })),
      ...ingredientIds.map((ingredientId) => ({ ingredients: { some: { ingredientId } } })),
    ],
  };

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
