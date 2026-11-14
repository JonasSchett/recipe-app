"use client";

import Link from "next/link";
import { useState } from "react";
import {
  updateGroupSharingDefaults,
  updateUserSettings,
} from "@/lib/actions/settings";
import { useAction } from "@/lib/use-action";

type Visibility = "PRIVATE" | "PUBLIC";

type GroupDefaults = {
  id: string;
  name: string;
  shareRecipesByDefault: boolean;
  shareNotesByDefault: boolean;
};

/**
 * A checkbox that saves as soon as it changes (no Save button) — the same
 * immediate-feedback pattern as `TagHeartButton`. Optimistic so it never lags
 * the tap, and reverts if the write fails.
 */
function AutoSaveCheckbox({
  initial,
  save,
  label,
  hint,
}: {
  initial: boolean;
  save: (next: boolean) => Promise<unknown>;
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  const [checked, setChecked] = useState(initial);
  const { pending, error, run } = useAction();

  function onToggle(next: boolean) {
    const previous = checked;
    setChecked(next);
    run(() => save(next), {
      failure: "Failed to save.",
      onError: () => setChecked(previous),
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={pending}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          {label}
          {hint && (
            <span className="block text-xs text-muted-foreground">{hint}</span>
          )}
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Per-user sharing defaults. All of them are *form defaults*: they decide what
 * the create-recipe form and a new note start with, and never change anything
 * already saved.
 */
export function UserSettingsForm({
  defaultRecipeVisibility,
  defaultNoteVisibility,
  groups,
}: {
  defaultRecipeVisibility: Visibility;
  defaultNoteVisibility: Visibility;
  groups: GroupDefaults[];
}) {
  const toVisibility = (on: boolean): Visibility => (on ? "PUBLIC" : "PRIVATE");

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        These only decide what a new recipe or note starts with — you can still
        change sharing on each one before saving, and nothing already saved is
        affected.
      </p>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Everyone</h3>
        <AutoSaveCheckbox
          initial={defaultRecipeVisibility === "PUBLIC"}
          save={(on) => updateUserSettings({ defaultRecipeVisibility: toVisibility(on) })}
          label="New recipes are public"
        />
        <AutoSaveCheckbox
          initial={defaultNoteVisibility === "PUBLIC"}
          save={(on) => updateUserSettings({ defaultNoteVisibility: toVisibility(on) })}
          label="New notes are shared with everyone who can see the recipe"
          hint="On a private recipe that's only the people it's shared with."
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Family groups</h3>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re not in any family groups.{" "}
            <Link href="/groups" className="underline underline-offset-2">
              Create or join one
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((group) => (
              <li key={group.id} className="flex flex-col gap-2 rounded-md border p-3">
                <Link
                  href={`/groups/${group.id}`}
                  className="text-sm font-medium underline-offset-2 hover:underline"
                >
                  {group.name}
                </Link>
                <AutoSaveCheckbox
                  initial={group.shareRecipesByDefault}
                  save={(on) =>
                    updateGroupSharingDefaults(group.id, { shareRecipesByDefault: on })
                  }
                  label="Share my new recipes with this group"
                />
                <AutoSaveCheckbox
                  initial={group.shareNotesByDefault}
                  save={(on) =>
                    updateGroupSharingDefaults(group.id, { shareNotesByDefault: on })
                  }
                  label="Share my new notes with this group"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
