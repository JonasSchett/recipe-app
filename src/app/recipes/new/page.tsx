import { redirect } from "next/navigation";
import { RecipeForm } from "@/components/recipe-form";
import { getCurrentUser } from "@/lib/auth-guards";
import { getEntityVocabulary, getUserSettings } from "@/lib/queries";

export default async function NewRecipePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [vocabulary, settings] = await Promise.all([
    getEntityVocabulary(),
    getUserSettings(),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Create Recipe</h1>
      <RecipeForm
        mode="create"
        vocabulary={vocabulary}
        // Pre-fill only — `createRecipe` still receives an explicit visibility.
        defaultVisibility={settings.defaultRecipeVisibility}
      />
    </div>
  );
}
