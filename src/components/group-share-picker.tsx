"use client";

import Link from "next/link";
import { Users } from "lucide-react";

export type PickableGroup = { id: string; name: string };

/**
 * One checkbox per family group the user belongs to. Used by the recipe form
 * and the note editor; the server re-checks membership on save, so this only
 * offers choices, it doesn't grant anything.
 */
export function GroupSharePicker({
  groups,
  selected,
  onChange,
  label,
  disabled,
}: {
  groups: PickableGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  label: string;
  disabled?: boolean;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        <Link href="/groups" className="underline underline-offset-2">
          Create or join a family group
        </Link>{" "}
        to share with just the people you cook with.
      </p>
    );
  }

  function toggle(id: string, on: boolean) {
    onChange(on ? [...selected, id] : selected.filter((g) => g !== id));
  }

  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        <Users className="h-4 w-4 text-muted-foreground" /> {label}
      </legend>
      {groups.map((group) => (
        <label key={group.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={selected.includes(group.id)}
            onChange={(e) => toggle(group.id, e.target.checked)}
          />
          {group.name}
        </label>
      ))}
    </fieldset>
  );
}
