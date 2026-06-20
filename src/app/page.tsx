import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeBrowser } from "@/components/recipe-browser";
import { getCurrentUser } from "@/lib/auth-guards";
import { getHeartedTagSections } from "@/lib/queries";

function parseList(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    tags?: string;
    ingredients?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();

  // Logged-out visitors get a simple landing page.
  if (!user) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Recipe App</h1>
        <p className="text-muted-foreground">
          Manage, share, and view your recipes. Sign in to get started.
        </p>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          Sign in
        </Link>
      </div>
    );
  }

  const { q, tags, ingredients, page } = await searchParams;
  const sections = await getHeartedTagSections();

  return (
    <div className="flex flex-col gap-10">
      {/* Personalized sections, one per hearted tag. */}
      {sections.length > 0 ? (
        <div className="flex flex-col gap-8">
          {sections.map(({ tag, recipes }) => (
            <section key={tag.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">{tag.name}</h2>
                <Link
                  href={`/recipes?tags=${tag.id}`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  View all
                </Link>
              </div>
              {recipes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recipes yet.</p>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {recipes.map((recipe) => (
                    <div key={recipe.id} className="w-72 shrink-0">
                      <RecipeCard recipe={recipe} orientation="vertical" />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tip: heart tags on the{" "}
          <Link href="/tags" className="underline">
            Tags page
          </Link>{" "}
          to get personalized sections here.
        </p>
      )}

      {sections.length > 0 && <hr className="border-border" />}

      {/* The full, filterable list. */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">All Recipes</h2>
          <Link href="/recipes/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4" /> Create
          </Link>
        </div>
        <RecipeBrowser
          basePath="/"
          search={q ?? ""}
          tagIds={parseList(tags)}
          ingredientIds={parseList(ingredients)}
          page={page ? Number(page) : 1}
        />
      </section>
    </div>
  );
}
