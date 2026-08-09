import Link from "next/link";
import { ImageOff, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreateListForm } from "@/components/create-list-form";
import { requirePageUser } from "@/lib/auth-guards";
import { getMyLists } from "@/lib/queries";

export default async function ListsPage() {
  const user = await requirePageUser();

  const lists = await getMyLists();
  const mine = lists.filter((list) => list.isOwner);
  const shared = lists.filter((list) => !list.isOwner);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Pinned Lists</h1>
        <p className="text-sm text-muted-foreground">
          Pin what you plan to cook, then share the list with whoever is cooking
          with you.
        </p>
      </div>

      <CreateListForm />

      <ListSection title="My lists" lists={mine} emptyHint="Create one above to get started." />
      <ListSection
        title="Shared with me"
        lists={shared}
        emptyHint="Lists other people share with you appear here."
      />
    </div>
  );
}

function ListSection({
  title,
  lists,
  emptyHint,
}: {
  title: string;
  lists: Awaited<ReturnType<typeof getMyLists>>;
  emptyHint: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {lists.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/lists/${list.id}`}
                className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{list.name}</h3>
                  {list._count.members > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {list._count.members}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {list.items.length === 0 ? (
                    <div className="flex h-14 w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  ) : (
                    list.items.map(({ recipe }) =>
                      recipe.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files
                        <img
                          key={recipe.id}
                          src={recipe.images[0].path}
                          alt={recipe.title}
                          className="h-14 w-14 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div
                          key={recipe.id}
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                        >
                          <ImageOff className="h-4 w-4" />
                        </div>
                      ),
                    )
                  )}
                </div>

                <p className="mt-auto text-sm text-muted-foreground">
                  {list._count.items} recipe{list._count.items === 1 ? "" : "s"}
                  {!list.isOwner &&
                    ` · from ${list.owner.name ?? list.owner.email ?? "someone"}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
