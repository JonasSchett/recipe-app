"use client";

import { useState } from "react";
import { Carrot, CheckSquare, Pin, Plus, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EntityAutocomplete } from "@/components/entity-autocomplete";
import {
  EMPTY_INGREDIENT_ROW,
  IngredientRows,
  parseIngredientRows,
  type IngredientRow,
} from "@/components/ingredient-rows";
import { useSelection } from "@/components/recipe-selection";
import {
  addIngredientsToRecipes,
  addTagsToRecipes,
  getSelectableRecipeIds,
} from "@/lib/actions/batch";
import { addRecipesToList } from "@/lib/actions/lists";
import { useAction } from "@/lib/use-action";
import type { PinnableList } from "@/components/pin-to-list";
import type { EntitySuggestion } from "@/lib/suggest";

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
 * Only rendered while selection mode is on.
 *
 * `pageRecipeIds` are the ids currently on screen, which is what "Select page"
 * adds — selecting everything matching the filter across pages would mean
 * sending the filter to the server instead of ids, which is not needed yet.
 */
export function BatchActionBar({
  pageRecipeIds,
  tagVocabulary = [],
  ingredientVocabulary = [],
  pinnableLists = [],
  filter,
  totalMatching,
}: {
  pageRecipeIds: string[];
  tagVocabulary?: EntitySuggestion[];
  ingredientVocabulary?: EntitySuggestion[];
  pinnableLists?: PinnableList[];
  /** The filter currently applied to the list, for "select all matching". */
  filter: { search: string; tagIds: string[]; ingredientIds: string[] };
  /** How many recipes match it in total, across every page. */
  totalMatching: number;
}) {
  const { active, selected, selectMany, clear, setActive } = useSelection();
  const [panel, setPanel] = useState<null | "tags" | "ingredients" | "lists">(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [rows, setRows] = useState<IngredientRow[]>([EMPTY_INGREDIENT_ROW]);
  const [message, setMessage] = useState<string | null>(null);
  const { pending, error, setError, run } = useAction();

  if (!active) return null;

  const count = selected.size;
  const allOnPageSelected = pageRecipeIds.every((id) => selected.has(id));

  function addTag(name = tagDraft) {
    const value = name.trim();
    if (value && !tags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setTags((prev) => [...prev, value]);
    }
    setTagDraft("");
  }

  function closePanel() {
    setPanel(null);
    setTags([]);
    setTagDraft("");
    setRows([EMPTY_INGREDIENT_ROW]);
    setError(null);
  }

  /** Run a batch action and report what it actually did. */
  function apply(
    action: () => Promise<{ updated: number; skipped: number }>,
    failure: string,
  ) {
    setMessage(null);
    run(action, {
      failure,
      onSuccess: (result) => {
        setMessage(
          `Added to ${result.updated} recipe${result.updated === 1 ? "" : "s"}` +
            (result.skipped > 0 ? ` · ${result.skipped} skipped (not yours)` : ""),
        );
        closePanel();
        clear();
      },
    });
  }

  function applyTags() {
    apply(
      () => addTagsToRecipes({ recipeIds: [...selected], tags }),
      "Failed to add tags.",
    );
  }

  const filledRows = rows.filter((row) => row.name.trim());

  function applyIngredients() {
    const parsed = parseIngredientRows(rows);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    apply(
      () =>
        addIngredientsToRecipes({
          recipeIds: [...selected],
          ingredients: parsed.ingredients,
        }),
      "Failed to add ingredients.",
    );
  }

  /**
   * Pinning reports differently from tagging: the list action skips recipes
   * the user can't *see* (and ones already pinned), not ones they can't edit,
   * so "not yours" would be the wrong words.
   */
  function pinToList(listId: string, listName: string) {
    setMessage(null);
    run(() => addRecipesToList(listId, [...selected]), {
      failure: "Could not pin them.",
      onSuccess: (result) => {
        setMessage(
          `Pinned ${result.added} recipe${result.added === 1 ? "" : "s"} to ${listName}` +
            (result.skipped > 0 ? ` · ${result.skipped} already there` : ""),
        );
        closePanel();
        clear();
      },
    });
  }

  /**
   * Select everything matching the filter, not just this page. The ids are
   * resolved on the server from the same filter the list used, so the
   * selection is exactly what's being looked at — and it's capped at what one
   * batch can take, which the message spells out when it bites.
   */
  function selectAllMatching() {
    setMessage(null);
    run(() => getSelectableRecipeIds(filter), {
      failure: "Could not select them all.",
      // Purely a client-side selection change — nothing on the server moved.
      refresh: false,
      onSuccess: ({ ids, total }) => {
        selectMany(ids);
        if (ids.length < total) {
          setMessage(
            `Selected ${ids.length} of ${total} — the most one batch can take. Apply, then select the rest.`,
          );
        }
      },
    });
  }

  return (
    // Padding-bottom on a spacer keeps the last row of cards reachable above
    // the fixed bar on a phone.
    <>
      <div className="h-24 md:h-0" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur md:sticky md:bottom-4 md:rounded-xl md:border md:shadow-lg">
        {panel === "tags" && (
          <div className="mx-auto mb-3 flex max-w-7xl flex-col gap-2 border-b pb-3">
            <div className="flex gap-2">
              <EntityAutocomplete
                className="flex-1"
                value={tagDraft}
                onValueChange={setTagDraft}
                onPick={(match) => addTag(match.label)}
                onEnter={() => addTag()}
                vocabulary={tagVocabulary}
                exclude={tags}
                placeholder="Add a tag and press Enter"
                aria-label="Tag to add to the selected recipes"
              />
              <Button type="button" variant="outline" onClick={() => addTag()}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((p) => p.filter((t) => t !== tag))}
                      aria-label={`Remove ${tag}`}
                      className="rounded-full hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={applyTags}
                disabled={pending || tags.length === 0 || count === 0}
              >
                {pending
                  ? "Applying…"
                  : `Apply to ${count} recipe${count === 1 ? "" : "s"}`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={closePanel}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {panel === "ingredients" && (
          <div className="mx-auto mb-3 flex max-w-7xl flex-col gap-2 border-b pb-3">
            <div className="flex max-h-52 flex-col gap-2 overflow-y-auto">
              <IngredientRows
                rows={rows}
                onRowsChange={setRows}
                vocabulary={ingredientVocabulary}
                labelPrefix="Batch ingredient"
                keepOneRow
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setRows((prev) => [...prev, EMPTY_INGREDIENT_ROW])
              }
            >
              <Plus className="h-4 w-4" /> Add row
            </Button>
            <p className="text-xs text-muted-foreground">
              Recipes that already list an ingredient keep their own quantity —
              this only adds missing lines.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={applyIngredients}
                disabled={pending || filledRows.length === 0 || count === 0}
              >
                {pending
                  ? "Applying…"
                  : `Apply to ${count} recipe${count === 1 ? "" : "s"}`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={closePanel}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        {panel === "lists" && (
          <div className="mx-auto mb-3 flex max-w-7xl flex-col gap-2 border-b pb-3">
            {pinnableLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t have any lists to pin into yet — create one on the
                Pinned Lists page.
              </p>
            ) : (
              <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {pinnableLists.map((list) => (
                  <li key={list.id}>
                    <button
                      type="button"
                      onClick={() => pinToList(list.id, list.name)}
                      disabled={pending}
                      className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                    >
                      <span className="truncate font-medium">{list.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {list._count.items}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={closePanel}
              disabled={pending}
            >
              Cancel
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {count} selected
          </span>
          {message && (
            <span className="text-sm text-muted-foreground">{message}</span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMessage(null);
                setPanel(panel === "tags" ? null : "tags");
              }}
              disabled={count === 0}
            >
              <Tags className="h-4 w-4" /> Add tags
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMessage(null);
                setPanel(panel === "ingredients" ? null : "ingredients");
              }}
              disabled={count === 0}
            >
              <Carrot className="h-4 w-4" /> Add ingredients
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMessage(null);
                setPanel(panel === "lists" ? null : "lists");
              }}
              disabled={count === 0}
            >
              <Pin className="h-4 w-4" /> Add to list
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => selectMany(pageRecipeIds)}
              disabled={pageRecipeIds.length === 0 || allOnPageSelected}
            >
              Select page
            </Button>
            {/* Only worth offering when there is more than this page to get. */}
            {totalMatching > pageRecipeIds.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllMatching}
                disabled={pending}
              >
                {pending ? "Selecting…" : `Select all ${totalMatching}`}
              </Button>
            )}
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
