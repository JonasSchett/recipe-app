"use client";

import { CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSelection } from "@/components/recipe-selection";

/**
 * Turns selection mode on and off. Sits next to the result count rather than
 * inside `RecipeFilters`, which stays purely about filtering.
 */
export function SelectionToggle() {
  const { active, setActive } = useSelection();
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={() => setActive(!active)}
    >
      <CheckSquare className="h-4 w-4" />
      {active ? "Done" : "Select"}
    </Button>
  );
}

/**
 * Sticky bar summarising the current selection and offering the batch actions.
 * Only rendered while selection mode is on; the actions themselves arrive in
 * the following commits.
 *
 * `pageRecipeIds` are the ids currently on screen, which is what "Select page"
 * adds — selecting everything matching the filter across pages would mean
 * sending the filter to the server instead of ids, which is not needed yet.
 */
export function BatchActionBar({
  pageRecipeIds,
}: {
  pageRecipeIds: string[];
}) {
  const { active, selected, selectMany, clear, setActive } = useSelection();

  if (!active) return null;

  const count = selected.size;
  const allOnPageSelected = pageRecipeIds.every((id) => selected.has(id));

  return (
    // Padding-bottom on a spacer keeps the last row of cards reachable above
    // the fixed bar on a phone.
    <>
      <div className="h-24 md:h-0" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur md:sticky md:bottom-4 md:rounded-xl md:border md:shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {count} selected
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectMany(pageRecipeIds)}
              disabled={pageRecipeIds.length === 0 || allOnPageSelected}
            >
              Select page
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={count === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActive(false)}
              aria-label="Exit selection mode"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
