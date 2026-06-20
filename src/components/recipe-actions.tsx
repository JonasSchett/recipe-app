"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Globe, Lock, Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteRecipe, setRecipeVisibility } from "@/lib/actions/recipes";
import { cn } from "@/lib/utils";

export function RecipeActions({
  recipeId,
  visibility,
}: {
  recipeId: string;
  visibility: "PRIVATE" | "PUBLIC";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleVisibility() {
    setError(null);
    startTransition(async () => {
      try {
        await setRecipeVisibility(
          recipeId,
          visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update.");
      }
    });
  }

  function onDelete() {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteRecipe(recipeId);
        router.push("/recipes");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/recipes/${recipeId}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Pencil className="h-4 w-4" /> Edit
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleVisibility}
          disabled={pending}
        >
          {visibility === "PUBLIC" ? (
            <>
              <Globe className="h-4 w-4" /> Public
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Private
            </>
          )}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
