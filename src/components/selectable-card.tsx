"use client";

import { Check } from "lucide-react";
import { useSelection } from "@/components/recipe-selection";
import { cn } from "@/lib/utils";

/**
 * Makes a recipe card selectable without touching `RecipeCard` itself, which
 * stays a plain server component used unchanged everywhere else.
 *
 * The card is passed as `children` (server-rendered, handed to this client
 * component by the server parent). While selection mode is on, an absolutely
 * positioned button covers the card and swallows the click, so the card's own
 * `<Link>` never navigates — no prop drilling into the card, no nested
 * interactive elements when selection is off.
 */
export function SelectableCard({
  recipeId,
  title,
  children,
}: {
  recipeId: string;
  title: string;
  children: React.ReactNode;
}) {
  const { active, selected, toggle } = useSelection();
  const isSelected = selected.has(recipeId);

  return (
    <div
      className={cn(
        "relative rounded-xl transition-shadow",
        active && isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      {children}

      {active && (
        <button
          type="button"
          onClick={() => toggle(recipeId)}
          aria-pressed={isSelected}
          aria-label={`${isSelected ? "Deselect" : "Select"} ${title}`}
          className="absolute inset-0 z-10 rounded-xl bg-transparent"
        >
          <span
            className={cn(
              "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 shadow-sm",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/60 bg-background/90",
            )}
          >
            {isSelected && <Check className="h-4 w-4" />}
          </span>
        </button>
      )}
    </div>
  );
}
