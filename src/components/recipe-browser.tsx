import Link from "next/link";
import { RecipeFilters } from "@/components/recipe-filters";
import { RecipeCard } from "@/components/recipe-card";
import { buttonVariants } from "@/components/ui/button";
import { getAllIngredients, getAllTags, getRecipes } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * The filterable, paginated "All Recipes" view: a multi-select filter over the
 * recipes the current user may see. Shared by the dashboard (`/`) and the
 * dedicated `/recipes` page; `basePath` is used for pagination links.
 */
export async function RecipeBrowser({
  basePath,
  search = "",
  tagIds = [],
  ingredientIds = [],
  page = 1,
}: {
  basePath: string;
  search?: string;
  tagIds?: string[];
  ingredientIds?: string[];
  page?: number;
}) {
  const [result, allTags, allIngredients] = await Promise.all([
    getRecipes({ search, tagIds, ingredientIds, page }),
    getAllTags(),
    getAllIngredients(),
  ]);
  const { items, total, page: current, pageCount } = result;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (tagIds.length) params.set("tags", tagIds.join(","));
    if (ingredientIds.length) params.set("ingredients", ingredientIds.join(","));
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-col gap-4">
      <RecipeFilters
        allTags={allTags.map((t) => ({ id: t.id, name: t.name }))}
        allIngredients={allIngredients.map((i) => ({ id: i.id, name: i.name }))}
        selectedTagIds={tagIds}
        selectedIngredientIds={ingredientIds}
        search={search}
      />

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No recipes match your filters.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} recipe{total === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Link
                href={pageHref(current - 1)}
                aria-disabled={current <= 1}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  current <= 1 && "pointer-events-none opacity-50",
                )}
              >
                Previous
              </Link>
              <span className="text-sm text-muted-foreground">
                Page {current} of {pageCount}
              </span>
              <Link
                href={pageHref(current + 1)}
                aria-disabled={current >= pageCount}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  current >= pageCount && "pointer-events-none opacity-50",
                )}
              >
                Next
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
