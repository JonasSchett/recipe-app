"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckSquare, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EntityAutocomplete } from "@/components/entity-autocomplete";
import { useSelection } from "@/components/recipe-selection";
import { addTagsToRecipes } from "@/lib/actions/batch";
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
}: {
  pageRecipeIds: string[];
  tagVocabulary?: EntitySuggestion[];
}) {
  const router = useRouter();
  const { active, selected, selectMany, clear, setActive } = useSelection();
  const [panel, setPanel] = useState<null | "tags">(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
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
    setError(null);
  }

  function applyTags() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await addTagsToRecipes({
          recipeIds: [...selected],
          tags,
        });
        setMessage(
          `Added to ${result.updated} recipe${result.updated === 1 ? "" : "s"}` +
            (result.skipped > 0 ? ` · ${result.skipped} skipped (not yours)` : ""),
        );
        closePanel();
        clear();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add tags.");
      }
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
