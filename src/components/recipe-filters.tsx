"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

/**
 * URL-driven multi-select filter for the recipe list: free-text search plus
 * any number of tags and ingredients. Selections are pushed to the query string
 * (`?q=&tags=a,b&ingredients=c`) so the server re-renders filtered, paginated
 * results. Multiple selections narrow with AND (a recipe must match them all).
 */
export function RecipeFilters({
  allTags,
  allIngredients,
  selectedTagIds,
  selectedIngredientIds,
  search,
}: {
  allTags: Option[];
  allIngredients: Option[];
  selectedTagIds: string[];
  selectedIngredientIds: string[];
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState(search);
  const [open, setOpen] = useState(false);

  function push(next: {
    q?: string;
    tags?: string[];
    ingredients?: string[];
  }) {
    const q = next.q ?? search;
    const tags = next.tags ?? selectedTagIds;
    const ingredients = next.ingredients ?? selectedIngredientIds;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tags.length) params.set("tags", tags.join(","));
    if (ingredients.length) params.set("ingredients", ingredients.join(","));
    // Omitting `page` resets to page 1 on any filter change.
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const nameOf = (options: Option[], id: string) =>
    options.find((o) => o.id === id)?.name ?? id;

  const activeCount = selectedTagIds.length + selectedIngredientIds.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: draft });
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search recipes…"
            className="pl-8"
          />
        </form>
        <Button
          type="button"
          variant={activeCount > 0 ? "default" : "outline"}
          onClick={() => setOpen((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 rounded-xl border p-4">
          <FilterGroup
            title="Tags"
            options={allTags}
            selected={selectedTagIds}
            onToggle={(id) => push({ tags: toggle(selectedTagIds, id) })}
          />
          <FilterGroup
            title="Ingredients"
            options={allIngredients}
            selected={selectedIngredientIds}
            onToggle={(id) =>
              push({ ingredients: toggle(selectedIngredientIds, id) })
            }
          />
        </div>
      )}

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedTagIds.map((id) => (
            <Chip
              key={`t-${id}`}
              label={nameOf(allTags, id)}
              onRemove={() => push({ tags: toggle(selectedTagIds, id) })}
            />
          ))}
          {selectedIngredientIds.map((id) => (
            <Chip
              key={`i-${id}`}
              label={nameOf(allIngredients, id)}
              onRemove={() =>
                push({ ingredients: toggle(selectedIngredientIds, id) })
              }
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => push({ tags: [], ingredients: [] })}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {options.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "hover:bg-accent",
              )}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="rounded-full hover:text-destructive"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
