import { notFound, redirect } from "next/navigation";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RecipeActions } from "@/components/recipe-actions";
import { getCurrentUser, isAdmin } from "@/lib/auth-guards";
import { getRecipeById } from "@/lib/queries";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  const canModify = isAdmin(user) || recipe.authorId === user.id;

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="aspect-video w-full overflow-hidden rounded-xl border bg-muted">
        {recipe.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imagePath}
            alt={recipe.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">{recipe.title}</h1>
          <Badge variant={recipe.visibility === "PUBLIC" ? "default" : "secondary"}>
            {recipe.visibility}
          </Badge>
        </div>
        {recipe.description && (
          <p className="text-muted-foreground">{recipe.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          By {recipe.author.name ?? recipe.author.email ?? "Unknown"}
        </p>
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map(({ tag }) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {canModify && (
        <RecipeActions recipeId={recipe.id} visibility={recipe.visibility} />
      )}

      {recipe.ingredients.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <ul className="flex flex-col gap-1">
            {recipe.ingredients.map(({ ingredient, quantity, unit }) => (
              <li key={ingredient.id} className="flex gap-2 text-sm">
                <span className="font-medium">
                  {[quantity ?? "", unit ?? ""].filter(Boolean).join(" ")}
                </span>
                <span>{ingredient.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Instructions</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {recipe.instructions}
        </p>
      </section>
    </article>
  );
}
