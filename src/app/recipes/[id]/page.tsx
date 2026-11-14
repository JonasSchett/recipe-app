import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KeepScreenAwake } from "@/components/keep-screen-awake";
import { RecipeActions } from "@/components/recipe-actions";
import { RecipeGallery } from "@/components/recipe-gallery";
import { RecipeNote } from "@/components/recipe-note";
import { PinToList } from "@/components/pin-to-list";
import { SharedNotes } from "@/components/shared-notes";
import { isAdmin, requirePageUser } from "@/lib/auth-guards";
import {
  getListsForPinning,
  getMyGroups,
  getRecipeById,
  getSharedNotes,
  getUserSettings,
} from "@/lib/queries";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();

  const { id } = await params;
  const recipe = await getRecipeById(id);
  if (!recipe) notFound();

  const canModify = isAdmin(user) || recipe.authorId === user.id;
  // Anyone who can see a recipe can pin it — including one shared with them.
  const [pinnableLists, groups, sharedNotes, settings] = await Promise.all([
    getListsForPinning(),
    getMyGroups(),
    getSharedNotes(recipe.id),
    getUserSettings(),
  ]);
  const myNote = recipe.notes[0];

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Cooking mode: don't let the phone screen sleep mid-recipe. */}
      <KeepScreenAwake />
      <RecipeGallery images={recipe.images} title={recipe.title} />

      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{recipe.title}</h1>
        <Badge variant={recipe.visibility === "PUBLIC" ? "default" : "secondary"}>
          {recipe.visibility}
        </Badge>
      </header>

      {/* Notes sit right under the title, before the description: they're what
          you need first when you come back to cook something again. */}
      <div className="flex flex-col gap-2">
        {/* Scoped to the viewer by `recipeDetailInclude`, so this is only ever
            their own note — never the author's. Others' shared notes come from
            `getSharedNotes`. */}
        <RecipeNote
          recipeId={recipe.id}
          initial={
            myNote
              ? {
                  body: myNote.body,
                  visibility: myNote.visibility,
                  groupIds: myNote.groupShares.map((share) => share.groupId),
                }
              : null
          }
          groups={groups}
          defaults={{
            visibility: settings.defaultNoteVisibility,
            groupIds: groups
              .filter((group) => group.shareNotesByDefault)
              .map((group) => group.id),
          }}
        />
        <SharedNotes notes={sharedNotes} />
      </div>

      <section className="flex flex-col gap-2">
        {recipe.description && (
          <p className="text-muted-foreground">{recipe.description}</p>
        )}
        <p className="text-sm text-muted-foreground">
          By {recipe.author.name ?? recipe.author.email ?? "Unknown"}
        </p>
        {recipe.groupShares.length > 0 && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Shared with{" "}
            {recipe.groupShares.map(({ group }) => group.name).join(", ")}
          </p>
        )}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.map(({ tag, displayName }) => (
              <Badge key={tag.id} variant="outline">
                {displayName ?? tag.name}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <PinToList recipeId={recipe.id} lists={pinnableLists} />

      {canModify && (
        <RecipeActions recipeId={recipe.id} visibility={recipe.visibility} />
      )}

      {recipe.ingredients.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Ingredients</h2>
          <ul className="flex flex-col gap-1">
            {recipe.ingredients.map(({ ingredient, displayName, quantity, unit }) => (
              <li key={ingredient.id} className="flex gap-2 text-sm">
                <span className="font-medium">
                  {[quantity ?? "", unit ?? ""].filter(Boolean).join(" ")}
                </span>
                <span>{displayName ?? ingredient.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe.instructions && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Instructions</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {recipe.instructions}
          </p>
        </section>
      )}
    </article>
  );
}
