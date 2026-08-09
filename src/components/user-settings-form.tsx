"use client";

import { useState } from "react";
import { updateUserSettings } from "@/lib/actions/settings";
import { useAction } from "@/lib/use-action";

/**
 * Per-user settings, saved as soon as a control changes (no Save button) —
 * the same immediate-feedback pattern as `TagHeartButton`. The checkbox is
 * optimistic so it never lags the tap, and reverts if the write fails.
 */
export function UserSettingsForm({
  defaultRecipeVisibility,
}: {
  defaultRecipeVisibility: "PRIVATE" | "PUBLIC";
}) {
  const [isPublic, setIsPublic] = useState(defaultRecipeVisibility === "PUBLIC");
  const { pending, error, run } = useAction();

  function onToggle(next: boolean) {
    const previous = isPublic;
    setIsPublic(next);
    run(
      () =>
        updateUserSettings({
          defaultRecipeVisibility: next ? "PUBLIC" : "PRIVATE",
        }),
      {
        failure: "Failed to save.",
        // The checkbox moved before the write; put it back if it didn't land.
        onError: () => setIsPublic(previous),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={pending}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          New recipes are public by default
          <span className="block text-xs text-muted-foreground">
            Only changes what the create form starts with — you can still switch
            any recipe before saving it.
          </span>
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
