import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "@/components/recipe-card";
import { getCurrentUser } from "@/lib/auth-guards";
import { getRecipes } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q, page } = await searchParams;
  const { items, total, page: current, pageCount } = await getRecipes({
    search: q,
    page: page ? Number(page) : 1,
  });

  const pageHref = (p: number) =>
    `/recipes?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">All Recipes</h1>
        <Link href="/recipes/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" /> Create
        </Link>
      </div>

      <form action="/recipes" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search recipes…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {q ? `No recipes match “${q}”.` : "No recipes yet — create your first one."}
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
