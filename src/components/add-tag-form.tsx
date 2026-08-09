"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityAutocomplete } from "@/components/entity-autocomplete";
import { createTag } from "@/lib/actions/tags";
import type { EntitySuggestion } from "@/lib/suggest";
import { useAction } from "@/lib/use-action";

/**
 * Standalone tag creation for the tags page. The autocomplete is the point:
 * it surfaces tags that already exist — in either language — so you don't
 * create "Nachtisch" next to an existing "Dessert". Picking an existing
 * suggestion is harmless anyway, since `createTag` resolves to the same entity.
 */
export function AddTagForm({ vocabulary }: { vocabulary: EntitySuggestion[] }) {
  const [draft, setDraft] = useState("");
  const { pending: busy, error, run } = useAction();

  function submit() {
    const name = draft.trim();
    if (!name || busy) return;
    run(() => createTag(name), {
      failure: "Could not create that tag.",
      onSuccess: () => setDraft(""),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <EntityAutocomplete
          className="flex-1"
          value={draft}
          onValueChange={setDraft}
          onPick={(match) => setDraft(match.label)}
          onEnter={submit}
          vocabulary={vocabulary}
          placeholder="Add a tag…"
          aria-label="Tag name"
          disabled={busy}
        />
        <Button type="submit" variant="outline" disabled={busy || !draft.trim()}>
          <Plus className="h-4 w-4" />
          {busy ? "Adding…" : "Add"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
