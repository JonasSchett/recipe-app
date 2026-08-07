"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moveListItem, removeRecipeFromList } from "@/lib/actions/lists";

/**
 * Reorder / unpin controls for one recipe on a list. Rendered only for editors
 * and owners; viewers see the card alone.
 *
 * Up/down arrows rather than drag-and-drop, matching how the recipe form
 * reorders images — and far easier to hit on a phone.
 */
export function ListItemActions({
  listId,
  recipeId,
  title,
  isFirst,
  isLast,
}: {
  listId: string;
  recipeId: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>, failure: string) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : failure);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending || isFirst}
        onClick={() => run(() => moveListItem(listId, recipeId, "up"), "Could not move it.")}
        aria-label={`Move ${title} up`}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending || isLast}
        onClick={() => run(() => moveListItem(listId, recipeId, "down"), "Could not move it.")}
        aria-label={`Move ${title} down`}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending}
        onClick={() =>
          run(() => removeRecipeFromList(listId, recipeId), "Could not unpin it.")
        }
        aria-label={`Unpin ${title}`}
      >
        <X className="h-4 w-4" />
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
