"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Carrot, CheckSquare, Plus, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EntityAutocomplete } from "@/components/entity-autocomplete";
import { useSelection } from "@/components/recipe-selection";
import { addIngredientsToRecipes, addTagsToRecipes } from "@/lib/actions/batch";
import type { EntitySuggestion } from "@/lib/suggest";

type IngredientRow = { name: string; quantity: string; unit: string };

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
}: {
  pageRecipeIds: string[];
  tagVocabulary?: EntitySuggestion[];
  ingredientVocabulary?: EntitySuggestion[];
}) {
  const router = useRouter();
  const { active, selected, selectMany, clear, setActive } = useSelection();
  const [panel, setPanel] = useState<null | "tags" | "ingredients">(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [rows, setRows] = useState<IngredientRow[]>([
    { name: "", quantity: "", unit: "" },
  ]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setRows([{ name: "", quantity: "", unit: "" }]);
    setError(null);
  }

  /** Run a batch action and report what it actually did. */
  function apply(
    run: () => Promise<{ updated: number; skipped: number }>,
    failure: string,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await run();
        setMessage(
          `Added to ${result.updated} recipe${result.updated === 1 ? "" : "s"}` +
            (result.skipped > 0 ? ` · ${result.skipped} skipped (not yours)` : ""),
        );
        closePanel();
        clear();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : failure);
      }
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
    const parsed = filledRows.map((row) => {
      const quantity = row.quantity.trim();
      return {
        name: row.name.trim(),
        quantity: quantity === "" ? null : Number(quantity),
        unit: row.unit.trim() || null,
      };
    });
    if (parsed.some((i) => i.quantity !== null && !(i.quantity! > 0))) {
      setError("Ingredient quantities must be positive numbers.");
      return;
    }
    apply(
      () =>
        addIngredientsToRecipes({
          recipeIds: [...selected],
          ingredients: parsed,
        }),
      "Failed to add ingredients.",
    );
  }

  function updateRow(index: number, patch: Partial<IngredientRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
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
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="w-20"
                    type="number"
                    step="any"
                    min="0"
                    value={row.quantity}
                    onChange={(e) => updateRow(i, { quantity: e.target.value })}
                    placeholder="Qty"
                    aria-label={`Batch ingredient ${i + 1} quantity`}
                  />
                  <Input
                    className="w-24"
                    value={row.unit}
                    onChange={(e) => updateRow(i, { unit: e.target.value })}
                    placeholder="Unit"
                    aria-label={`Batch ingredient ${i + 1} unit`}
                  />
                  <EntityAutocomplete
                    className="flex-1"
                    value={row.name}
                    onValueChange={(name) => updateRow(i, { name })}
                    onPick={(match) => updateRow(i, { name: match.label })}
                    vocabulary={ingredientVocabulary}
                    exclude={rows
                      .filter((_, other) => other !== i)
                      .map((r) => r.name)}
                    placeholder="Ingredient name"
                    aria-label={`Batch ingredient ${i + 1} name`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setRows((prev) => prev.filter((_, x) => x !== i))
                    }
                    disabled={rows.length === 1}
                    aria-label={`Remove batch ingredient ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setRows((prev) => [...prev, { name: "", quantity: "", unit: "" }])
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
