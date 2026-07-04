import Link from "next/link";
import { redirect } from "next/navigation";
import { ImageOff } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-guards";
import { getHeartedTagCards } from "@/lib/queries";

/**
 * Category-style overview of the user's hearted tags: one card per tag, using
 * a recipe image tagged with it as the cover. Clicking a card opens the
 * recipe list pre-filtered by that tag.
 */
export default async function FavouriteTagsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const cards = await getHeartedTagCards();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Favourite Tags</h1>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t hearted any tags yet. Heart tags on the{" "}
          <Link href="/tags" className="underline">
            Tags page
          </Link>{" "}
          to see them here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map(({ tag, imagePath }) => (
            <Link
              key={tag.id}
              href={`/recipes?tags=${tag.id}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:bg-accent/40"
            >
              <div className="relative aspect-video w-full bg-muted">
                {imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files in /public, not statically known
                  <img
                    src={imagePath}
                    alt={tag.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="truncate font-semibold leading-tight">
                  {tag.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
