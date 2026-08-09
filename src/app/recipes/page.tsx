import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  RecipeBrowser,
  recipeBrowserProps,
  type RecipeBrowserParams,
} from "@/components/recipe-browser";
import { getCurrentUser } from "@/lib/auth-guards";

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<RecipeBrowserParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">All Recipes</h1>
        <Link href="/recipes/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" /> Create
        </Link>
      </div>

      <RecipeBrowser basePath="/recipes" {...recipeBrowserProps(params)} />
    </div>
  );
}
