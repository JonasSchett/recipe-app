import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import {
  RecipeBrowser,
  recipeBrowserProps,
  type RecipeBrowserParams,
} from "@/components/recipe-browser";
import { CHANGE_PASSWORD_PATH, getCurrentUser } from "@/lib/auth-guards";
import { getHeartedTagSections, getMyLists } from "@/lib/queries";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RecipeBrowserParams>;
}) {
  const user = await getCurrentUser();
  if (user?.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);

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

  const params = await searchParams;
  const [sections, lists] = await Promise.all([
    getHeartedTagSections(),
    getMyLists(),
  ]);
  // The most recently touched list only. The dashboard is for "what am I
  // cooking now" — a wall of every list belongs on /lists.
  const currentList = lists.find((list) => list._count.items > 0);

  return (
    <div className="flex flex-col gap-10">
      {/* What's pinned right now, above everything else. */}
      {currentList && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {currentList.name}
            </h2>
            <Link
              href={`/lists/${currentList.id}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              Open list
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {currentList.items.map(({ recipe }) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="flex w-40 shrink-0 flex-col gap-2"
              >
                {recipe.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files
                  <img
                    src={recipe.images[0].path}
                    alt={recipe.title}
                    className="h-28 w-40 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-28 w-40 rounded-lg bg-muted" />
                )}
                <span className="line-clamp-2 text-sm font-medium">
                  {recipe.title}
                </span>
              </Link>
            ))}
            {currentList._count.items > currentList.items.length && (
              <Link
                href={`/lists/${currentList.id}`}
                className="flex w-40 shrink-0 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-accent/40"
              >
                +{currentList._count.items - currentList.items.length} more
              </Link>
            )}
          </div>
          <hr className="border-border" />
        </section>
      )}

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
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
                  {recipes.map((recipe) => (
                    <RecipeCard key={recipe.id} recipe={recipe} />
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
        <RecipeBrowser basePath="/" {...recipeBrowserProps(params)} />
      </section>
    </div>
  );
}
