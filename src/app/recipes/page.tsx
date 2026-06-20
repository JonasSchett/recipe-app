import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RecipeBrowser } from "@/components/recipe-browser";
import { getCurrentUser } from "@/lib/auth-guards";

function parseList(value?: string): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export default async function RecipesPage({
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
  if (!user) redirect("/login");

  const { q, tags, ingredients, page } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">All Recipes</h1>
        <Link href="/recipes/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" /> Create
        </Link>
      </div>

      <RecipeBrowser
        basePath="/recipes"
        search={q ?? ""}
        tagIds={parseList(tags)}
        ingredientIds={parseList(ingredients)}
        page={page ? Number(page) : 1}
      />
    </div>
  );
}
