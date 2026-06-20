import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { TagHeartButton } from "@/components/tag-heart-button";
import { getCurrentUser } from "@/lib/auth-guards";
import { getAllTags } from "@/lib/queries";

export default async function TagsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tags = await getAllTags();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">All Tags</h1>

      {tags.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No tags yet — they’re created automatically when you add them to a recipe.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-4 p-3">
              <div className="flex items-center gap-3">
                <TagHeartButton tagId={tag.id} hearted={tag.hearted} />
                <Link
                  href={`/recipes?q=${encodeURIComponent(tag.name)}`}
                  className="font-medium hover:underline"
                >
                  {tag.name}
                </Link>
              </div>
              <Badge variant="secondary">
                {tag.recipeCount} recipe{tag.recipeCount === 1 ? "" : "s"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
