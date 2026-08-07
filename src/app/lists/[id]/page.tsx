import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import { ListHeaderActions } from "@/components/list-header-actions";
import { ListItemActions } from "@/components/list-item-actions";
import { ListSharePanel } from "@/components/list-share-panel";
import { getCurrentUser } from "@/lib/auth-guards";
import { getListById } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const result = await getListById(id);
  // Also covers "exists but not shared with me" — deliberately indistinguishable.
  if (!result) notFound();

  const { list, permission } = result;
  const canEdit = permission === "OWNER" || permission === "EDITOR";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
            <p className="text-sm text-muted-foreground">
              {list.items.length} recipe{list.items.length === 1 ? "" : "s"}
              {permission !== "OWNER" &&
                ` · shared by ${list.owner.name ?? list.owner.email ?? "someone"}`}
              {permission === "VIEWER" && " · view only"}
            </p>
          </div>
          <ListHeaderActions
            listId={list.id}
            name={list.name}
            permission={permission}
          />
        </div>
      </header>

      {list.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <p className="text-muted-foreground">Nothing pinned yet.</p>
          {canEdit && (
            <Link
              href="/recipes"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Plus className="h-4 w-4" /> Browse recipes to pin
            </Link>
          )}
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {list.items.map((item, index) => (
            <li key={item.recipeId} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-sm text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <RecipeCard recipe={item.recipe} />
              </div>
              {canEdit && (
                <ListItemActions
                  listId={list.id}
                  recipeId={item.recipeId}
                  title={item.recipe.title}
                  isFirst={index === 0}
                  isLast={index === list.items.length - 1}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {permission === "OWNER" ? (
        <ListSharePanel
          listId={list.id}
          shareToken={list.shareToken}
          shareRole={list.shareRole}
          members={list.members}
          privateRecipeCount={
            list.items.filter((item) => item.recipe.visibility === "PRIVATE")
              .length
          }
        />
      ) : (
        list.members.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Shared with</h2>
            <ul className="flex flex-wrap gap-2">
              {list.members.map((member) => (
                <li key={member.userId}>
                  <Badge variant="secondary">
                    {member.user.name ?? member.user.email}
                    {member.role === "VIEWER" && " · view only"}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
