"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityAutocomplete } from "@/components/entity-autocomplete";
import { createTag } from "@/lib/actions/tags";
import type { EntitySuggestion } from "@/lib/suggest";

/**
 * Standalone tag creation for the tags page. The autocomplete is the point:
 * it surfaces tags that already exist — in either language — so you don't
 * create "Nachtisch" next to an existing "Dessert". Picking an existing
 * suggestion is harmless anyway, since `createTag` resolves to the same entity.
 */
export function AddTagForm({ vocabulary }: { vocabulary: EntitySuggestion[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const name = draft.trim();
    if (!name || busy) return;
    setError(null);
    setBusy(true);
    try {
      await createTag(name);
      setDraft("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that tag.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <EntityAutocomplete
          className="flex-1"
          value={draft}
          onValueChange={setDraft}
          onPick={(match) => setDraft(match.label)}
          onEnter={() => void submit()}
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
