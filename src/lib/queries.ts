import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  requireAdmin,
  requireUser,
  type SessionUser,
} from "@/lib/auth-guards";
import {
  BATCH_RECIPE_LIMIT,
  recipeFilterSchema,
  type RecipeFilter,
} from "@/lib/validations";
import {
  INGREDIENT_TRANSLATIONS,
  TAG_TRANSLATIONS,
} from "@/lib/i18n/dictionary";
import { isAuthMethodEnabled } from "@/lib/auth-methods";
import { withDictionary, type EntitySuggestion } from "@/lib/suggest";
import { searchRecipeIds } from "@/lib/recipe-search";
import { getListPermission, listAccessWhere } from "@/lib/list-access";

/**
 * Prisma `where` fragment restricting recipes to those a user may view:
 * admins see everything; everyone else sees PUBLIC recipes, their own, and
 * anything pinned to a list they own or belong to.
 *
 * That third branch is what makes a shared meal plan work: pinning a private
 * recipe to a list you share lets its members **read** it. It grants read
 * only — `assertCanModifyRecipe` is untouched, so a member still cannot edit
 * or delete a recipe that isn't theirs — and it is scoped to lists the viewer
 * is actually on, so it never widens access beyond people the owner invited.
 *
 * Everything that reads recipes funnels through here, so this one fragment is
 * the whole of the grant.
 */
export function visibilityWhere(user: SessionUser): Prisma.RecipeWhereInput {
  if (user.role === "ADMIN") return {};
  return {
    OR: [
      { visibility: "PUBLIC" },
      { authorId: user.id },
      {
        listItems: {
          some: {
            list: {
              OR: [
                { ownerId: user.id },
                { members: { some: { userId: user.id } } },
              ],
            },
          },
        },
      },
    ],
  };
}

/**
 * Include shape returning a recipe with its author, ingredients, tags — and the
 * viewer's own note, if any.
 *
 * Takes the viewer's id because notes are private: the `where` here is the only
 * thing that keeps one user's notes out of another's payload, so every caller
 * must pass the *current* user's id and never a recipe author's.
 */
function recipeDetailInclude(userId: string) {
  return {
    author: { select: { id: true, name: true, email: true, image: true } },
    images: { orderBy: { position: "asc" } },
    ingredients: { include: { ingredient: true } },
    tags: { include: { tag: true } },
    notes: { where: { userId }, take: 1 },
  } satisfies Prisma.RecipeInclude;
}

export type RecipeDetail = Prisma.RecipeGetPayload<{
  include: ReturnType<typeof recipeDetailInclude>;
}>;

/**
 * Turn a filter into the Prisma `where` the recipe list uses, plus the
 * relevance ranking when there's a search term.
 *
 * Shared by `getRecipes` and `getFilteredRecipeIds` on purpose: "select all
 * matching" has to resolve to exactly the set the user is looking at, and two
 * copies of this would eventually disagree.
 */
async function recipeMatchWhere(
  user: SessionUser,
  filter: { search?: string; tagIds: string[]; ingredientIds: string[] },
) {
  // The fuzzy pass runs first and yields ranked ids, which then act as one more
  // filter — so visibility and the tag/ingredient selections still decide what
  // is actually returned.
  const ranked = filter.search
    ? await searchRecipeIds(filter.search, user.id)
    : null;

  const where: Prisma.RecipeWhereInput = {
    AND: [
      visibilityWhere(user),
      ...(ranked ? [{ id: { in: ranked.map((row) => row.id) } }] : []),
      ...filter.tagIds.map((tagId) => ({ tags: { some: { tagId } } })),
      ...filter.ingredientIds.map((ingredientId) => ({
        ingredients: { some: { ingredientId } },
      })),
    ],
  };

  return {
    where,
    rankOf: ranked
      ? new Map(ranked.map((row, index) => [row.id, index]))
      : null,
  };
}

/**
 * Paginated list of recipes the current user may view, optionally narrowed by
 * search text and by tags/ingredients (AND across every selection).
 *
 * Search is fuzzy (see `lib/recipe-search.ts`): it matches the title,
 * description and instructions, any localized tag/ingredient alias, and the
 * current user's own notes, tolerating typos and missing umlauts. A search is
 * ordered by relevance; without one the list stays alphabetical.
 */
export async function getRecipes(filter: Partial<RecipeFilter> = {}) {
  const user = await requireUser();
  const { search, tagIds, ingredientIds, page, pageSize } =
    recipeFilterSchema.parse(filter);

  const { where, rankOf: ranked } = await recipeMatchWhere(user, {
    search,
    tagIds,
    ingredientIds,
  });

  // Relevance order can't be expressed in SQL here (it lives in the ranked id
  // list), so a search fetches its matches — capped by the search's own
  // candidate limit — and pages them in memory.
  if (ranked) {
    const matches = await prisma.recipe.findMany({
      where,
      include: recipeDetailInclude(user.id),
    });
    matches.sort((a, b) => ranked.get(a.id)! - ranked.get(b.id)!);

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
      include: recipeDetailInclude(user.id),
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

/**
 * Every recipe id matching a filter, for "select all matching" — the whole
 * result set, not just the page on screen.
 *
 * Capped at `BATCH_RECIPE_LIMIT`, the same ceiling the batch actions enforce,
 * so a selection can never be built that they would then reject. `total` is
 * the untruncated count, so the caller can say how many were left out. When
 * searching, the cap keeps the *most relevant* matches rather than an
 * arbitrary slice.
 */
export async function getFilteredRecipeIds(filter: Partial<RecipeFilter> = {}) {
  const user = await requireUser();
  const { search, tagIds, ingredientIds } = recipeFilterSchema.parse(filter);

  const { where, rankOf } = await recipeMatchWhere(user, {
    search,
    tagIds,
    ingredientIds,
  });

  const rows = await prisma.recipe.findMany({
    where,
    select: { id: true },
    // Ordering only matters for which ones survive the cap.
    ...(rankOf ? {} : { orderBy: { title: "asc" as const } }),
  });

  const ordered = rankOf
    ? [...rows].sort((a, b) => rankOf.get(a.id)! - rankOf.get(b.id)!)
    : rows;

  return {
    ids: ordered.slice(0, BATCH_RECIPE_LIMIT).map((row) => row.id),
    total: ordered.length,
  };
}

/** A single recipe by id, or `null` if it does not exist or is not visible. */
export async function getRecipeById(id: string): Promise<RecipeDetail | null> {
  const user = await requireUser();
  const recipe = await prisma.recipe.findFirst({
    where: { AND: [{ id }, visibilityWhere(user)] },
    include: recipeDetailInclude(user.id),
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
        include: recipeDetailInclude(user.id),
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

/**
 * Every list the current user can see — their own and any shared with them —
 * newest activity first, with a few recipe images for a thumbnail strip.
 */
export async function getMyLists() {
  const user = await requireUser();
  const lists = await prisma.recipeList.findMany({
    where: listAccessWhere(user),
    orderBy: { updatedAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { items: true, members: true } },
      items: {
        orderBy: { position: "asc" },
        take: 4,
        select: {
          recipe: {
            select: {
              id: true,
              title: true,
              images: { orderBy: { position: "asc" }, take: 1, select: { path: true } },
            },
          },
        },
      },
    },
  });

  return lists.map((list) => ({
    ...list,
    isOwner: list.ownerId === user.id,
  }));
}

/**
 * One list with its recipes in pinned order, plus the caller's permission.
 * Returns `null` when the list doesn't exist *or* isn't shared with them —
 * the two are deliberately indistinguishable.
 *
 * The recipes come back through `recipeDetailInclude`, so cards render exactly
 * as they do elsewhere (including the viewer's own note marker).
 */
export async function getListById(id: string) {
  const user = await requireUser();
  const permission = await getListPermission(user, id);
  if (!permission) return null;

  const list = await prisma.recipeList.findUniqueOrThrow({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, image: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
      invites: { orderBy: { createdAt: "asc" } },
      items: {
        orderBy: { position: "asc" },
        include: { recipe: { include: recipeDetailInclude(user.id) } },
      },
    },
  });

  return { list, permission, viewerId: user.id };
}

/**
 * Look up a list by its share token, for the join page. Returns `null` when
 * the token is unknown — which is the normal outcome for a revoked or rotated
 * link, not an error.
 *
 * No access check: holding the token *is* the credential. Only the name and
 * role are exposed, never the list's recipes.
 */
export async function getListByShareToken(token: string) {
  if (!token) return null;
  return prisma.recipeList.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      name: true,
      shareRole: true,
      owner: { select: { name: true, email: true } },
      _count: { select: { items: true } },
    },
  });
}

/** The lists the user may pin into (owner or editor), for the pin picker. */
export async function getListsForPinning() {
  const user = await requireUser();
  return prisma.recipeList.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id, role: "EDITOR" } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, _count: { select: { items: true } } },
  });
}

/**
 * The current user's settings (see /account). Read fresh from the row rather
 * than the session so a change takes effect on the very next render.
 *
 * `hasPassword` distinguishes a password account from a Google one, which is
 * what decides whether /account offers a "change password" link. As in
 * `getAllUsers`, the digest itself never leaves this function.
 */
export async function getUserSettings() {
  const user = await requireUser();
  const { passwordHash, ...settings } = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      defaultRecipeVisibility: true,
      username: true,
      passwordHash: true,
    },
  });
  return { ...settings, hasPassword: passwordHash !== null };
}

/**
 * All users with their role and recipe count, for the admin console.
 *
 * `passwordHash` is read only to derive `hasPassword` and is never returned —
 * the digest has no business leaving the server, and the page only needs to
 * know whether a reset button applies.
 */
export async function getAllUsers() {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }, { username: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      image: true,
      role: true,
      createdAt: true,
      passwordHash: true,
      mustChangePassword: true,
      _count: { select: { recipes: true } },
    },
  });

  return users.map(({ passwordHash, ...user }) => ({
    ...user,
    hasPassword: passwordHash !== null,
  }));
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

/**
 * Whether the app has no accounts at all, so the login page should offer
 * first-run setup instead of a sign-in form.
 *
 * Deliberately unauthenticated — there is nobody to authenticate yet. It leaks
 * only "this instance is empty", and it stops being true forever after the
 * first account exists, which is also what closes the setup action.
 */
export async function isFirstRunSetupNeeded(): Promise<boolean> {
  if (!isAuthMethodEnabled("password")) return false;
  return (await prisma.user.count()) === 0;
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
