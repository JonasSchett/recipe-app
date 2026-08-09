"use client";

import { Trash2 } from "lucide-react";
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
 * The quantity/unit/name row editor, used by the recipe form and by the batch
 * bar's "add ingredients" panel.
 *
 * `labelPrefix` keeps the aria-labels distinct when both can be on screen, and
 * `keepOneRow` stops the batch panel deleting its only row.
 */
export function IngredientRows({
  rows,
  onRowsChange,
  vocabulary,
  labelPrefix = "Ingredient",
  keepOneRow = false,
}: {
  rows: IngredientRow[];
  onRowsChange: (rows: IngredientRow[]) => void;
  vocabulary: EntitySuggestion[];
  labelPrefix?: string;
  keepOneRow?: boolean;
}) {
  const update = (index: number, patch: Partial<IngredientRow>) =>
    onRowsChange(
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  return (
    <>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="w-20"
            type="number"
            step="any"
            min="0"
            value={row.quantity}
            onChange={(e) => update(i, { quantity: e.target.value })}
            placeholder="Qty"
            aria-label={`${labelPrefix} ${i + 1} quantity`}
          />
          <Input
            className="w-24"
            value={row.unit}
            onChange={(e) => update(i, { unit: e.target.value })}
            placeholder="Unit"
            aria-label={`${labelPrefix} ${i + 1} unit`}
          />
          <EntityAutocomplete
            className="flex-1"
            value={row.name}
            onValueChange={(name) => update(i, { name })}
            onPick={(match) => update(i, { name: match.label })}
            vocabulary={vocabulary}
            // Don't re-offer an ingredient another row already uses — the
            // composite PK forbids the same ingredient twice on a recipe.
            exclude={rows.filter((_, other) => other !== i).map((r) => r.name)}
            placeholder="Ingredient name"
            aria-label={`${labelPrefix} ${i + 1} name`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRowsChange(rows.filter((_, x) => x !== i))}
            disabled={keepOneRow && rows.length === 1}
            aria-label={`Remove ${labelPrefix.toLowerCase()} ${i + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </>
  );
}
