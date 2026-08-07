"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateUserSettings } from "@/lib/actions/settings";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isPublic, setIsPublic] = useState(defaultRecipeVisibility === "PUBLIC");
  const [error, setError] = useState<string | null>(null);

  function onToggle(next: boolean) {
    const previous = isPublic;
    setIsPublic(next);
    setError(null);
    startTransition(async () => {
      try {
        await updateUserSettings({
          defaultRecipeVisibility: next ? "PUBLIC" : "PRIVATE",
        });
        router.refresh();
      } catch (err) {
        setIsPublic(previous);
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
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
