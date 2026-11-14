import { notFound } from "next/navigation";
import { RecipeCard } from "@/components/recipe-card";
import { GroupHeaderActions } from "@/components/group-header-actions";
import { GroupMembersPanel } from "@/components/group-members-panel";
import { requirePageUser } from "@/lib/auth-guards";
import { getGroupById } from "@/lib/queries";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();

  const { id } = await params;
  const result = await getGroupById(id);
  // Also covers "exists but I'm not in it" — deliberately indistinguishable.
  if (!result) notFound();

  const { group, permission, shareToken, invites } = result;
  const recipes = group.recipeShares.map((share) => share.recipe);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.members.length} member{group.members.length === 1 ? "" : "s"}
            {" · "}
            {recipes.length} shared recipe{recipes.length === 1 ? "" : "s"}
          </p>
        </div>
        <GroupHeaderActions
          groupId={group.id}
          name={group.name}
          isOwner={permission === "OWNER"}
        />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Shared recipes</h2>
        {recipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing shared yet. Tick this group under “Share with family groups”
            when creating or editing one of your recipes.
          </p>
        ) : (
          <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <RecipeCard recipe={recipe} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <GroupMembersPanel
        groupId={group.id}
        ownerId={group.ownerId}
        viewerId={user.id}
        members={group.members}
        invites={invites}
        shareToken={shareToken}
      />
    </div>
  );
}
