"use client";

import { useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityAutocomplete } from "@/components/entity-autocomplete";
import type { EntitySuggestion } from "@/lib/suggest";

/** One editable ingredient line. Quantity stays a string until it is parsed. */
export type IngredientRow = { name: string; quantity: string; unit: string };

export const EMPTY_INGREDIENT_ROW: IngredientRow = {
  name: "",
  quantity: "",
  unit: "",
};

/**
 * Validate typed rows into Server Action input. Blank-named rows are dropped
 * (an empty trailing row is normal), and a quantity that isn't a positive
 * number is rejected rather than silently sent — `Number("abc")` is NaN, which
 * fails `> 0` the same way a negative does.
 *
 * Shared by the recipe form and the batch bar so the two can't disagree about
 * what a valid amount is.
 */
export function parseIngredientRows(
  rows: IngredientRow[],
):
  | {
      ok: true;
      ingredients: { name: string; quantity: number | null; unit: string | null }[];
    }
  | { ok: false; error: string } {
  const ingredients = rows
    .filter((row) => row.name.trim())
    .map((row) => {
      const quantity = row.quantity.trim();
      return {
        name: row.name.trim(),
        quantity: quantity === "" ? null : Number(quantity),
        unit: row.unit.trim() || null,
      };
    });

  if (ingredients.some((i) => i.quantity !== null && !(i.quantity > 0))) {
    return { ok: false, error: "Ingredient quantities must be positive numbers." };
  }
  return { ok: true, ingredients };
}

/**
 * The list plus whatever is still typed in the entry row, for submitting — so
 * "type it, then press Save" doesn't silently drop it. Left out when it's
 * blank or already listed (the same ingredient twice would be rejected).
 */
export function rowsWithDraft(
  rows: IngredientRow[],
  draft: IngredientRow,
): IngredientRow[] {
  const name = draft.name.trim().toLowerCase();
  if (!name) return rows;
  return rows.some((row) => row.name.trim().toLowerCase() === name)
    ? rows
    : [...rows, draft];
}

/** "200 g" — the amount part of a line, empty when there is none. */
function amount(row: IngredientRow): string {
  return [row.quantity.trim(), row.unit.trim()].filter(Boolean).join(" ");
}

/**
 * The ingredient editor used by the recipe form and by the batch bar's "add
 * ingredients" panel — shaped like the tag input: an always-open entry row
 * (qty / unit / name / Add), where Enter or Add appends the ingredient to the
 * list below.
 *
 * The entry row is controlled (`draft`) rather than internal so that a caller
 * can include a typed-but-not-yet-added ingredient when it submits; otherwise
 * "type it, then press Save" would silently drop it.
 *
 * Editing a listed ingredient moves it back into the entry row; adding it
 * again puts it back where it was. `labelPrefix` keeps the aria-labels
 * distinct when both editors can be on screen.
 */
export function IngredientEditor({
  rows,
  onRowsChange,
  draft,
  onDraftChange,
  vocabulary,
  labelPrefix = "Ingredient",
}: {
  rows: IngredientRow[];
  onRowsChange: (rows: IngredientRow[]) => void;
  draft: IngredientRow;
  onDraftChange: (draft: IngredientRow) => void;
  vocabulary: EntitySuggestion[];
  labelPrefix?: string;
}) {
  const quantityRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // The line being edited: where it came from, and what it was, so Cancel can
  // put it back untouched.
  const [editing, setEditing] = useState<{ index: number; original: IngredientRow } | null>(
    null,
  );

  const update = (patch: Partial<IngredientRow>) => {
    setError(null);
    onDraftChange({ ...draft, ...patch });
  };

  /** Validate `candidate` and insert it into `into`, or report why not. */
  function insert(
    into: IngredientRow[],
    candidate: IngredientRow,
    at: number | null,
  ): IngredientRow[] | null {
    const name = candidate.name.trim();
    const parsed = parseIngredientRows([candidate]);
    if (!parsed.ok) {
      setError(parsed.error);
      return null;
    }
    if (into.some((row) => row.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`${name} is already in the list.`);
      return null;
    }
    const row = { name, quantity: candidate.quantity.trim(), unit: candidate.unit.trim() };
    const next = [...into];
    next.splice(at ?? next.length, 0, row);
    return next;
  }

  function add(name = draft.name) {
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    const next = insert(rows, { ...draft, name }, editing?.index ?? null);
    if (!next) return;
    onRowsChange(next);
    onDraftChange(EMPTY_INGREDIENT_ROW);
    setEditing(null);
    setError(null);
    // Straight on to the next one, starting from its amount.
    quantityRef.current?.focus();
  }

  function edit(index: number) {
    let list = rows;
    let target = index;
    // Don't throw away something half-typed: add it first (back in its own
    // slot, if it was itself being edited), or say why not.
    if (draft.name.trim()) {
      const at = editing?.index ?? rows.length;
      const withDraft = insert(rows, draft, at);
      if (!withDraft) return;
      if (at <= index) target += 1;
      list = withDraft;
    }
    const row = list[target];
    onRowsChange(list.filter((_, i) => i !== target));
    onDraftChange(row);
    // Re-inserting at `target` in the shortened list restores its position.
    setEditing({ index: target, original: row });
    setError(null);
    nameRef.current?.focus();
  }

  function cancelEdit() {
    if (!editing) return;
    const next = [...rows];
    next.splice(editing.index, 0, editing.original);
    onRowsChange(next);
    onDraftChange(EMPTY_INGREDIENT_ROW);
    setEditing(null);
    setError(null);
  }

  /**
   * Enter in qty/unit must not submit the surrounding form. Add when there's
   * already a name, otherwise move on to the next field.
   */
  function onFieldEnter(
    e: React.KeyboardEvent<HTMLInputElement>,
    next: React.RefObject<HTMLInputElement | null>,
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (draft.name.trim()) add();
    else next.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          ref={quantityRef}
          className="w-16 shrink-0 sm:w-20"
          type="number"
          step="any"
          min="0"
          value={draft.quantity}
          onChange={(e) => update({ quantity: e.target.value })}
          onKeyDown={(e) => onFieldEnter(e, unitRef)}
          placeholder="Qty"
          aria-label={`${labelPrefix} quantity`}
        />
        <Input
          ref={unitRef}
          className="w-20 shrink-0 sm:w-24"
          value={draft.unit}
          onChange={(e) => update({ unit: e.target.value })}
          onKeyDown={(e) => onFieldEnter(e, nameRef)}
          placeholder="Unit"
          aria-label={`${labelPrefix} unit`}
        />
        <EntityAutocomplete
          ref={nameRef}
          className="min-w-0 flex-1"
          value={draft.name}
          onValueChange={(name) => update({ name })}
          // Picking a suggestion adds it straight away, like pressing Enter —
          // the same as the tag input.
          onPick={(match) => add(match.label)}
          onEnter={() => add()}
          vocabulary={vocabulary}
          // Never re-offer one already listed: the composite PK forbids the
          // same ingredient twice on a recipe.
          exclude={rows.map((row) => row.name)}
          placeholder="Ingredient"
          aria-label={`${labelPrefix} name`}
        />
        <Button type="button" variant="outline" onClick={() => add()}>
          {editing ? "Save" : "Add"}
        </Button>
      </div>

      {editing && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          Editing {editing.original.name}.
          <button
            type="button"
            onClick={cancelEdit}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Cancel
          </button>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {rows.length > 0 && (
        <ul className="flex flex-col divide-y rounded-md border">
          {rows.map((row, i) => (
            <li key={`${row.name}-${i}`} className="flex items-center gap-2 py-1 pl-3 pr-1">
              <span className="w-20 shrink-0 text-sm font-medium tabular-nums">
                {amount(row)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => edit(i)}
                aria-label={`Edit ${row.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  onRowsChange(rows.filter((_, x) => x !== i));
                  // Indices after this one shift down by one.
                  if (editing && editing.index > i) {
                    setEditing({ ...editing, index: editing.index - 1 });
                  }
                }}
                aria-label={`Remove ${row.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
