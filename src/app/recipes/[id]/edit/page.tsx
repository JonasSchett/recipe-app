import { notFound, redirect } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { getCurrentUser, isAdmin } from "@/lib/auth-guards";
import { getRecipeById } from "@/lib/queries";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  // Only the author or an admin may edit.
  if (!isAdmin(user) && recipe.authorId !== user.id) redirect(`/recipes/${id}`);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Edit Recipe</h1>
      <RecipeForm
        mode="edit"
        recipeId={recipe.id}
        initial={{
          title: recipe.title,
          description: recipe.description ?? "",
          instructions: recipe.instructions,
          visibility: recipe.visibility,
          imagePaths: recipe.images.map((img) => img.path),
          ingredients: recipe.ingredients.map(
            ({ ingredient, displayName, quantity, unit }) => ({
              name: displayName ?? ingredient.name,
              quantity,
              unit,
            }),
          ),
          tags: recipe.tags.map(({ tag, displayName }) => displayName ?? tag.name),
        }}
      />
    </div>
  );
}
