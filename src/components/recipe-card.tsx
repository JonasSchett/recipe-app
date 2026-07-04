import Link from "next/link";
import { ImageOff, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RecipeDetail } from "@/lib/queries";

/**
 * Global recipe card: square image on the left, bold title, short description,
 * and pill badges for tags. Designed to sit in an auto-fill grid column
 * (min ~18rem) and stretch with it, staying roughly 16:9–2:1 overall.
 */
export function RecipeCard({ recipe }: { recipe: RecipeDetail }) {
  const tags = recipe.tags.map((t) => ({
    id: t.tag.id,
    label: t.displayName ?? t.tag.name,
  }));
  const heroImage = recipe.images[0]?.path ?? null;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:bg-accent/40"
    >
      <div className="relative aspect-square w-32 shrink-0 self-stretch bg-muted sm:w-36">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- runtime-uploaded files in /public, not statically known
          <img
            src={heroImage}
            alt={recipe.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-semibold leading-tight">{recipe.title}</h3>
          {recipe.visibility === "PRIVATE" && (
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </div>
        {recipe.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {recipe.description}
          </p>
        )}
        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {tags.slice(0, 4).map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.label}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="outline">+{tags.length - 4}</Badge>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
